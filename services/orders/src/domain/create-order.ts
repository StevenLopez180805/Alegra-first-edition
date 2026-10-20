import { randomUUID } from "node:crypto";
import type { Order, OrderItem, PrepareOrderItemMessage } from "@jag/shared";

export interface NewOrder {
  order: Order;
  items: OrderItem[];
  messages: PrepareOrderItemMessage[];
}

/** Construye el pedido y sus `quantity` ítems en PENDING. La receta la asigna el worker */
export function buildOrder(
  quantity: number,
  now: string = new Date().toISOString(),
  newId: () => string = randomUUID,
): NewOrder {
  const orderId = newId();
  const order: Order = { orderId, quantity, deliveredCount: 0, failedCount: 0, createdAt: now, updatedAt: now };
  const items: OrderItem[] = Array.from({ length: quantity }, () => ({
    itemId: newId(),
    orderId,
    status: "PENDING",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  }));
  const messages = items.map((item): PrepareOrderItemMessage => ({ type: "PrepareOrderItem", orderId, itemId: item.itemId }));
  return { order, items, messages };
}
