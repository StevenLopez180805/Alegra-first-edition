import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
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
