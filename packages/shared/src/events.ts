/** Mensaje SQS: uno por plato a preparar. */
export interface PrepareOrderItemMessage {
  type: "PrepareOrderItem";
  orderId: string;
  itemId: string;
}

export function parsePrepareOrderItem(body: string): PrepareOrderItemMessage {
  const data = JSON.parse(body) as Partial<PrepareOrderItemMessage> | null;
  if (data?.type === "PrepareOrderItem" && typeof data.orderId === "string" && typeof data.itemId === "string") {
    return { type: data.type, orderId: data.orderId, itemId: data.itemId };
  }
  throw new Error("Mensaje PrepareOrderItem inválido");
}
