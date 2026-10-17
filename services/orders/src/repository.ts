import { BatchWriteCommand, QueryCommand, type BatchWriteCommandInput } from "@aws-sdk/lib-dynamodb";
import { GSI1, getDocumentClient, keys, stripKeys, tableName } from "@jag/persistence";
import {
  ACTIVE_ITEM_STATUSES,
  deriveOrderStatus,
  deriveOrderStatusFromCounts,
  type Order,
  type OrderItem,
  type OrderSummary,
  type OrderWithItems,
} from "@jag/shared";

const BATCH_SIZE = 25;
const MAX_BATCH_RETRIES = 5;

type WriteRequests = NonNullable<BatchWriteCommandInput["RequestItems"]>[string];

async function batchWrite(requests: WriteRequests): Promise<void> {
  for (let start = 0; start < requests.length; start += BATCH_SIZE) {
    let pending: WriteRequests = requests.slice(start, start + BATCH_SIZE);
    for (let attempt = 0; pending.length > 0; attempt++) {
      if (attempt > MAX_BATCH_RETRIES) throw new Error("BatchWrite: quedaron escrituras sin procesar");
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 50 * 2 ** attempt));
      const result = await getDocumentClient().send(new BatchWriteCommand({ RequestItems: { [tableName()]: pending } }));
      pending = result.UnprocessedItems?.[tableName()] ?? [];
    }
  }
}

export function orderItemRecord(item: OrderItem) {
  return { ...keys.orderItem(item.orderId, item.itemId), ...keys.orderItemGsi(item.status, item.createdAt), ...item };
}

/** Persiste pedido + ítems antes de encolar (si el encolado falla, quedan PENDING recuperables). */
export async function saveOrder(order: Order, items: OrderItem[]): Promise<void> {
  await batchWrite([
    { PutRequest: { Item: { ...keys.order(order.orderId), ...keys.orderGsi(order.createdAt, order.orderId), ...order } } },
    ...items.map((item) => ({ PutRequest: { Item: orderItemRecord(item) } })),
  ]);
}

export async function listOrders(limit: number): Promise<OrderSummary[]> {
  const result = await getDocumentClient().send(
    new QueryCommand({
      TableName: tableName(),
      IndexName: GSI1,
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: { ":pk": "ORDERS" },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  return (result.Items ?? []).map((record) => {
    const order = stripKeys<Order>(record);
    return { ...order, status: deriveOrderStatusFromCounts(order.quantity, order.deliveredCount, order.failedCount) };
  });
}

export async function getOrderWithItems(orderId: string): Promise<OrderWithItems | undefined> {
  const records: Record<string, unknown>[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const result = await getDocumentClient().send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": keys.order(orderId).PK },
        ExclusiveStartKey: startKey,
      }),
    );
    records.push(...(result.Items ?? []));
    startKey = result.LastEvaluatedKey;
  } while (startKey);

  const meta = records.find((record) => record.SK === "META");
  if (!meta) return undefined;
  const items = records.filter((record) => String(record.SK).startsWith("ITEM#")).map((r) => stripKeys<OrderItem>(r));
  return { ...stripKeys<Order>(meta), status: deriveOrderStatus(items.map((item) => item.status)), items };
}

/** Ítems en cocina (PENDING / PREPARING / WAITING_INGREDIENTS), más antiguos primero. */
export async function listActiveItems(limitPerStatus: number): Promise<OrderItem[]> {
  const pages = await Promise.all(
    ACTIVE_ITEM_STATUSES.map((status) =>
      getDocumentClient().send(
        new QueryCommand({
          TableName: tableName(),
          IndexName: GSI1,
          KeyConditionExpression: "GSI1PK = :pk",
          ExpressionAttributeValues: { ":pk": `ITEMSTATE#${status}` },
          Limit: limitPerStatus,
        }),
      ),
    ),
  );
  return pages
    .flatMap((page) => page.Items ?? [])
    .map((record) => stripKeys<OrderItem>(record))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
