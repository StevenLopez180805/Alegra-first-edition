import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { GetCommand, QueryCommand, TransactWriteCommand, type TransactWriteCommandInput } from "@aws-sdk/lib-dynamodb";
import { getDocumentClient, keys, nowIso, stripKeys, tableName } from "@jag/persistence";
import type { Ingredient, IngredientName, Recipe, StockMovement } from "@jag/shared";
import type { StockSnapshot } from "./domain/shortages";

export type TransactItem = NonNullable<TransactWriteCommandInput["TransactItems"]>[number];

export async function getStock(): Promise<Ingredient[]> {
  const result = await getDocumentClient().send(
    new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": keys.ingredient("").PK },
    }),
  );
  return (result.Items ?? []).map((item) => stripKeys<Ingredient>(item));
}

export async function getStockSnapshot(): Promise<StockSnapshot> {
  const stock = await getStock();
  return Object.fromEntries(stock.map((ingredient) => [ingredient.name, ingredient.stock]));
}

export async function isAlreadyConsumed(itemId: string): Promise<boolean> {
  const result = await getDocumentClient().send(
    new GetCommand({ TableName: tableName(), Key: keys.consumption(itemId), ProjectionExpression: "PK" }),
  );
  return result.Item !== undefined;
}

function movementPut(movement: StockMovement): TransactItem {
  return {
    Put: {
      TableName: tableName(),
      Item: {
        ...keys.movement(movement.movementId),
        ...keys.movementGsi(movement.createdAt, movement.movementId),
        ...movement,
      },
    },
  };
}

/**
 * Operaciones transaccionales para consumir los ingredientes de un ítem.
 * El worker de preparación las combina con el cambio de estado a DELIVERED en un
 * único TransactWriteItems (INV-02): o se aplica todo o nada.
 *  - `stock >= :q` impide saldos negativos (invariante 2).
 *  - El marcador CONSUMPTION#<itemId> impide un segundo descuento (invariantes 3 y 4).
 */
export function buildConsumptionTransactItems(itemId: string, recipe: Recipe, now = nowIso()): TransactItem[] {
  const ingredientUpdates: TransactItem[] = recipe.ingredients.map(({ name, quantity }) => ({
    Update: {
      TableName: tableName(),
      Key: keys.ingredient(name),
      UpdateExpression: "SET stock = stock - :q, updatedAt = :now",
      ConditionExpression: "attribute_exists(PK) AND stock >= :q",
      ExpressionAttributeValues: { ":q": quantity, ":now": now },
    },
  }));

  const movements = recipe.ingredients.map(({ name, quantity }) =>
    movementPut({
      movementId: `CONSUME#${itemId}#${name}`,
      itemId,
      ingredient: name,
      delta: -quantity,
      reason: "CONSUMPTION",
      createdAt: now,
    }),
  );

  const marker: TransactItem = {
    Put: {
      TableName: tableName(),
      Item: { ...keys.consumption(itemId), itemId, recipeId: recipe.recipeId, createdAt: now },
      ConditionExpression: "attribute_not_exists(PK)",
    },
  };

  return [...ingredientUpdates, ...movements, marker];
}

/**
 * Suma unidades confirmadas por el mercado. Idempotente por `purchaseId` (invariante 5):
 * devuelve false si esa compra ya se había aplicado.
 */
export async function restock(ingredient: IngredientName, quantity: number, purchaseId: string): Promise<boolean> {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error(`Cantidad de reposición inválida: ${quantity}`);
  }
  const now = nowIso();
  try {
    await getDocumentClient().send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: tableName(),
              Item: { ...keys.restock(purchaseId), purchaseId, ingredient, quantity, createdAt: now },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
          {
            Update: {
              TableName: tableName(),
              Key: keys.ingredient(ingredient),
              UpdateExpression: "ADD stock :q SET updatedAt = :now",
              ExpressionAttributeValues: { ":q": quantity, ":now": now },
            },
          },
          movementPut({
            movementId: `PURCHASE#${purchaseId}`,
            purchaseId,
            ingredient,
            delta: quantity,
            reason: "PURCHASE",
            createdAt: now,
          }),
        ],
      }),
    );
    return true;
  } catch (error) {
    if (error instanceof TransactionCanceledException && error.CancellationReasons?.[0]?.Code === "ConditionalCheckFailed") {
      return false;
    }
    throw error;
  }
}
