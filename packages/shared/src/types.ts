import type { IngredientName } from "./constants";
import type { ItemStatus, OrderStatus } from "./status";

export interface Ingredient {
  name: IngredientName;
  stock: number;
  updatedAt: string;
}

export interface RecipeIngredient {
  name: IngredientName;
  quantity: number;
}

export interface Recipe {
  recipeId: string;
  name: string;
  ingredients: RecipeIngredient[];
}

export interface Order {
  orderId: string;
  quantity: number;
  /** Contadores actualizados en la misma transacción que el estado final de cada ítem. */
  deliveredCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderSummary extends Order {
  status: OrderStatus;
}

export interface OrderWithItems extends OrderSummary {
  items: OrderItem[];
}

export interface OrderItem {
  itemId: string;
  orderId: string;
  recipeId?: string;
  status: ItemStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
}

/**
 * REQUESTED: el intento se registró antes de llamar al mercado y aún no tiene resultado. Si se queda así,
 * la Lambda murió a mitad de la compra y el resultado es incierto (el mercado no es idempotente).
 */
export type PurchaseStatus = "REQUESTED" | "SOLD" | "UNAVAILABLE" | "ERROR";

export interface PurchaseAttempt {
  purchaseId: string;
  itemId: string;
  ingredient: IngredientName;
  quantitySold: number;
  status: PurchaseStatus;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export type StockMovementReason = "SEED" | "PURCHASE" | "CONSUMPTION";

export interface StockMovement {
  movementId: string;
  itemId?: string;
  purchaseId?: string;
  ingredient: IngredientName;
  delta: number;
  reason: StockMovementReason;
  createdAt: string;
}
