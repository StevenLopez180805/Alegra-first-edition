// Formas exactas de las respuestas de los handlers en services/*/src/handler.ts.
import type {
  Ingredient,
  OrderItem,
  OrderStatus,
  OrderSummary,
  OrderWithItems,
  PurchaseAttempt,
  Recipe,
} from "@jag/shared/types";

export type {
  Ingredient,
  IngredientName,
  ItemStatus,
  OrderItem,
  OrderStatus,
  OrderSummary,
  OrderWithItems,
  PurchaseAttempt,
  PurchaseStatus,
  Recipe,
} from "@jag/shared/types";

/** POST /orders → 202 */
export interface CreateOrderResponse {
  orderId: string;
  quantity: number;
  status: Extract<OrderStatus, "PENDING">;
}

export interface OrdersResponse {
  orders: OrderSummary[];
}
export type OrderDetailResponse = OrderWithItems;
export interface PreparationsResponse {
  items: OrderItem[];
}
export interface InventoryResponse {
  ingredients: Ingredient[];
}
export interface PurchasesResponse {
  purchases: PurchaseAttempt[];
}
export interface RecipesResponse {
  recipes: Recipe[];
}
