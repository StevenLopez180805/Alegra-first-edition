export const ITEM_STATUSES = [
  "PENDING",
  "PREPARING",
  "WAITING_INGREDIENTS",
  "DELIVERED",
  "FAILED",
] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number];

/** Estados en los que un ítem sigue en cocina (vista /preparations). */
export const ACTIVE_ITEM_STATUSES: readonly ItemStatus[] = ["PENDING", "PREPARING", "WAITING_INGREDIENTS"];

const TRANSITIONS: Record<ItemStatus, readonly ItemStatus[]> = {
  PENDING: ["PREPARING", "FAILED"],
  PREPARING: ["WAITING_INGREDIENTS", "DELIVERED", "FAILED"],
  WAITING_INGREDIENTS: ["PREPARING", "FAILED"],
  DELIVERED: [],
  FAILED: [],
};

export function canTransition(from: ItemStatus, to: ItemStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Estados desde los que se puede llegar a `to` (para construir ConditionExpression). */
export function allowedSourcesFor(to: ItemStatus): ItemStatus[] {
  return ITEM_STATUSES.filter((from) => canTransition(from, to));
}

export type OrderStatus = "PENDING" | "IN_PROGRESS" | "DELIVERED" | "PARTIALLY_DELIVERED" | "FAILED";

/** El estado del pedido se deriva de sus ítems; nunca es DELIVERED si falta alguno. */
export function deriveOrderStatus(itemStatuses: readonly ItemStatus[]): OrderStatus {
  if (itemStatuses.length === 0) return "PENDING";
  const delivered = itemStatuses.filter((s) => s === "DELIVERED").length;
  const failed = itemStatuses.filter((s) => s === "FAILED").length;

  if (delivered === itemStatuses.length) return "DELIVERED";
  if (failed === itemStatuses.length) return "FAILED";
  if (delivered + failed === itemStatuses.length) return "PARTIALLY_DELIVERED";
  if (itemStatuses.every((s) => s === "PENDING")) return "PENDING";
  return "IN_PROGRESS";
}

/** Variante para listados: usa los contadores del pedido sin leer todos sus ítems. */
export function deriveOrderStatusFromCounts(quantity: number, deliveredCount: number, failedCount: number): OrderStatus {
  if (deliveredCount === quantity) return "DELIVERED";
  if (failedCount === quantity) return "FAILED";
  if (deliveredCount + failedCount === quantity) return "PARTIALLY_DELIVERED";
  return "IN_PROGRESS";
}
