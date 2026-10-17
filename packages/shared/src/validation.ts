import { DEFAULT_MAX_ORDER_ITEMS } from "./constants";
import { HttpError } from "./http";

export function maxOrderItems(): number {
  const fromEnv = Number(process.env.MAX_ORDER_ITEMS);
  return Number.isInteger(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_MAX_ORDER_ITEMS;
}

/** Valida `quantity` de POST /orders: entero entre 1 y MAX_ORDER_ITEMS. */
export function parseQuantity(body: unknown, max = maxOrderItems()): number {
  const quantity = (body as { quantity?: unknown } | null)?.quantity;
  if (typeof quantity !== "number" || !Number.isInteger(quantity)) {
    throw new HttpError(400, "quantity debe ser un número entero");
  }
  if (quantity < 1 || quantity > max) {
    throw new HttpError(400, `quantity debe estar entre 1 y ${max}`);
  }
  return quantity;
}
