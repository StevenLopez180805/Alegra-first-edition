import type { ItemStatus } from "@jag/shared";

/**
 * Diseño single-table. Cada dominio escribe solo sus propios prefijos de clave
 */
export const GSI1 = "GSI1";

export const keys = {
  ingredient: (name: string) => ({ PK: "INGREDIENT", SK: name }),
  recipe: (recipeId: string) => ({ PK: "RECIPE", SK: recipeId }),

  order: (orderId: string) => ({ PK: `ORDER#${orderId}`, SK: "META" }),
  orderGsi: (createdAt: string, orderId: string) => ({ GSI1PK: "ORDERS", GSI1SK: `${createdAt}#${orderId}` }),

  orderItem: (orderId: string, itemId: string) => ({ PK: `ORDER#${orderId}`, SK: `ITEM#${itemId}` }),
  orderItemGsi: (status: ItemStatus, createdAt: string) => ({ GSI1PK: `ITEMSTATE#${status}`, GSI1SK: createdAt }),

  purchase: (purchaseId: string) => ({ PK: `PURCHASE#${purchaseId}`, SK: "META" }),
  purchaseGsi: (createdAt: string, purchaseId: string) => ({
    GSI1PK: "PURCHASES",
    GSI1SK: `${createdAt}#${purchaseId}`,
  }),

  movement: (movementId: string) => ({ PK: `MOVEMENT#${movementId}`, SK: "META" }),
  movementGsi: (createdAt: string, movementId: string) => ({
    GSI1PK: "MOVEMENTS",
    GSI1SK: `${createdAt}#${movementId}`,
  }),

  /** Marcador de consumo: existe solo si el ítem ya descontó inventario (invariantes 3 y 4). */
  consumption: (itemId: string) => ({ PK: `CONSUMPTION#${itemId}`, SK: "META" }),
  /** Marcador de reposición: evita aplicar dos veces la misma compra (invariante 5). */
  restock: (purchaseId: string) => ({ PK: `RESTOCK#${purchaseId}`, SK: "META" }),

  /**
   * Outbox de encolado, esto existe mientras los platos de un pedido no se hayan encolado todos.
   * Ordenado por fecha para que el barrido consulte solo los vencidos.
   */
  outbox: (createdAt: string, orderId: string) => ({ PK: "OUTBOX", SK: `${createdAt}#${orderId}` }),
} as const;

const KEY_ATTRIBUTES = new Set(["PK", "SK", "GSI1PK", "GSI1SK"]);

/** Quita los atributos de clave antes de exponer un registro por la API. */
export function stripKeys<T>(record: Record<string, unknown>): T {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !KEY_ATTRIBUTES.has(key))) as T;
}
