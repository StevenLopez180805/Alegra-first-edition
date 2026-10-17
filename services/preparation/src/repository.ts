import { ConditionalCheckFailedException, TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { GetCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { buildConsumptionTransactItems, type TransactItem } from "@jag/inventory";
import { getDocumentClient, keys, nowIso, stripKeys, tableName } from "@jag/persistence";
import { allowedSourcesFor, type OrderItem, type Recipe } from "@jag/shared";
import type { DeliveryResult } from "./domain/prepare-item";

// Nota: el worker actualiza registros ORDER#/ITEM# (estado del ítem) dentro de la tabla compartida;
// es el único escritor de transiciones posteriores a PENDING. Ver PLANNING.md §2.

export async function getItem(orderId: string, itemId: string): Promise<OrderItem | undefined> {
  const result = await getDocumentClient().send(
    new GetCommand({ TableName: tableName(), Key: keys.orderItem(orderId, itemId), ConsistentRead: true }),
  );
  return result.Item ? stripKeys<OrderItem>(result.Item) : undefined;
}

export async function startAttempt(item: OrderItem): Promise<OrderItem | undefined> {
  // PREPARING → PREPARING se permite para recuperar un worker que murió a mitad de proceso.
  const sources = [...new Set([...allowedSourcesFor("PREPARING"), "PREPARING"])];
  const placeholders = Object.fromEntries(sources.map((status, i) => [`:s${i}`, status]));
  try {
    const result = await getDocumentClient().send(
      new UpdateCommand({
        TableName: tableName(),
        Key: keys.orderItem(item.orderId, item.itemId),
        UpdateExpression: "SET #status = :preparing, GSI1PK = :gsi, updatedAt = :now ADD attempts :one",
        ConditionExpression: `#status IN (${Object.keys(placeholders).join(", ")})`,
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ...placeholders,
          ":preparing": "PREPARING",
          ":gsi": "ITEMSTATE#PREPARING",
          ":now": nowIso(),
          ":one": 1,
        },
        ReturnValues: "ALL_NEW",
      }),
    );
    return result.Attributes ? stripKeys<OrderItem>(result.Attributes) : undefined;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) return undefined;
    throw error;
  }
}

export async function assignRecipe(item: OrderItem, recipeId: string): Promise<string> {
  const result = await getDocumentClient().send(
    new UpdateCommand({
      TableName: tableName(),
      Key: keys.orderItem(item.orderId, item.itemId),
      UpdateExpression: "SET recipeId = if_not_exists(recipeId, :recipeId)",
      ExpressionAttributeValues: { ":recipeId": recipeId },
      ReturnValues: "UPDATED_NEW",
    }),
  );
  return String(result.Attributes?.recipeId ?? recipeId);
}

/**
 * Consumo de ingredientes + DELIVERED + contador del pedido en una sola transacción (INV-02).
 * Orden de operaciones: [inventario…, movimientos…, marcador, ítem, pedido].
 */
export async function tryDeliver(item: OrderItem, recipe: Recipe): Promise<DeliveryResult> {
  const now = nowIso();
  const consumption = buildConsumptionTransactItems(item.itemId, recipe, now);
  const markerIndex = consumption.length - 1;
  const transactItems: TransactItem[] = [
    ...consumption,
    {
      Update: {
        TableName: tableName(),
        Key: keys.orderItem(item.orderId, item.itemId),
        UpdateExpression: "SET #status = :delivered, updatedAt = :now REMOVE GSI1PK, GSI1SK, lastError",
        ConditionExpression: "#status = :preparing",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":delivered": "DELIVERED", ":preparing": "PREPARING", ":now": now },
      },
    },
    {
      Update: {
        TableName: tableName(),
        Key: keys.order(item.orderId),
        UpdateExpression: "ADD deliveredCount :one SET updatedAt = :now",
        ExpressionAttributeValues: { ":one": 1, ":now": now },
      },
    },
  ];

  try {
    await getDocumentClient().send(new TransactWriteCommand({ TransactItems: transactItems }));
    return "DELIVERED";
  } catch (error) {
    if (!(error instanceof TransactionCanceledException)) throw error;
    const reasons = error.CancellationReasons ?? [];
    if (reasons[markerIndex]?.Code === "ConditionalCheckFailed") return "ALREADY_DONE";
    const stockFailed = recipe.ingredients.some((_, i) => reasons[i]?.Code === "ConditionalCheckFailed");
    if (stockFailed) return "INSUFFICIENT_STOCK";
    // TransactionConflict u otro motivo: se relanza para que SQS reintente el mensaje.
    throw error;
  }
}

export async function markWaiting(item: OrderItem, reason: string): Promise<void> {
  await getDocumentClient().send(
    new UpdateCommand({
      TableName: tableName(),
      Key: keys.orderItem(item.orderId, item.itemId),
      UpdateExpression: "SET #status = :waiting, GSI1PK = :gsi, lastError = :reason, updatedAt = :now",
      ConditionExpression: "#status = :preparing",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":waiting": "WAITING_INGREDIENTS",
        ":preparing": "PREPARING",
        ":gsi": "ITEMSTATE#WAITING_INGREDIENTS",
        ":reason": reason,
        ":now": nowIso(),
      },
    }),
  );
}

export async function markFailed(item: OrderItem, reason: string): Promise<void> {
  const now = nowIso();
  await getDocumentClient().send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: tableName(),
            Key: keys.orderItem(item.orderId, item.itemId),
            UpdateExpression: "SET #status = :failed, lastError = :reason, updatedAt = :now REMOVE GSI1PK, GSI1SK",
            ConditionExpression: "#status <> :failed AND #status <> :delivered",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: { ":failed": "FAILED", ":delivered": "DELIVERED", ":reason": reason, ":now": now },
          },
        },
        {
          Update: {
            TableName: tableName(),
            Key: keys.order(item.orderId),
            UpdateExpression: "ADD failedCount :one SET updatedAt = :now",
            ExpressionAttributeValues: { ":one": 1, ":now": now },
          },
        },
      ],
    }),
  );
}
