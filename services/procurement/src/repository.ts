import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { PutCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { buildRestockTransactItems, type TransactItem } from "@jag/inventory";
import { GSI1, getDocumentClient, keys, stripKeys, tableName } from "@jag/persistence";
import type { PurchaseAttempt } from "@jag/shared";

export async function savePurchase(purchase: PurchaseAttempt): Promise<void> {
  await getDocumentClient().send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        ...keys.purchase(purchase.purchaseId),
        ...keys.purchaseGsi(purchase.createdAt, purchase.purchaseId),
        ...purchase,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    }),
  );
}

/** Cierre de la compra: solo desde REQUESTED, así un intento no se cierra dos veces. */
function completeUpdate(purchase: PurchaseAttempt): TransactItem {
  const setError = purchase.error === undefined ? "" : ", #error = :error";
  return {
    Update: {
      TableName: tableName(),
      Key: keys.purchase(purchase.purchaseId),
      UpdateExpression: `SET #status = :status, quantitySold = :quantitySold, completedAt = :completedAt${setError}`,
      ConditionExpression: "#status = :requested",
      ExpressionAttributeNames: { "#status": "status", ...(setError ? { "#error": "error" } : {}) },
      ExpressionAttributeValues: {
        ":status": purchase.status,
        ":quantitySold": purchase.quantitySold,
        ":completedAt": purchase.completedAt,
        ":requested": "REQUESTED",
        ...(setError ? { ":error": purchase.error } : {}),
      },
    },
  };
}

/**
 * Cierra el intento con su resultado. Si es SOLD, la reposición de inventario va en la misma
 * transacción: no puede quedar una compra SOLD sin su stock ni stock sin su compra.
 * Devuelve false si el intento ya estaba cerrado o la reposición ya se había aplicado.
 */
export async function completePurchase(purchase: PurchaseAttempt): Promise<boolean> {
  const transactItems: TransactItem[] = [completeUpdate(purchase)];
  if (purchase.status === "SOLD") {
    transactItems.push(
      ...buildRestockTransactItems(purchase.ingredient, purchase.quantitySold, purchase.purchaseId, purchase.completedAt),
    );
  }
  try {
    await getDocumentClient().send(new TransactWriteCommand({ TransactItems: transactItems }));
    return true;
  } catch (error) {
    const reasons = error instanceof TransactionCanceledException ? (error.CancellationReasons ?? []) : [];
    // [0] cierre de la compra, [1] marcador RESTOCK#: cualquiera de los dos indica que ya se aplicó.
    if (reasons[0]?.Code === "ConditionalCheckFailed" || reasons[1]?.Code === "ConditionalCheckFailed") return false;
    throw error;
  }
}

/** Historial de compras, más recientes primero. */
export async function listPurchases(limit: number): Promise<PurchaseAttempt[]> {
  const result = await getDocumentClient().send(
    new QueryCommand({
      TableName: tableName(),
      IndexName: GSI1,
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: { ":pk": "PURCHASES" },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  return (result.Items ?? []).map((item) => stripKeys<PurchaseAttempt>(item));
}
