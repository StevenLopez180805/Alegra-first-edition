export const INGREDIENTS = [
  "tomato",
  "lemon",
  "potato",
  "rice",
  "ketchup",
  "lettuce",
  "onion",
  "cheese",
  "meat",
  "chicken",
] as const;

export type IngredientName = (typeof INGREDIENTS)[number];

export const INITIAL_STOCK = 5;

/** Límite de platos por pedido; se puede sobrescribir con la variable de entorno MAX_ORDER_ITEMS. */
export const DEFAULT_MAX_ORDER_ITEMS = 100;

/** Intentos de preparación antes de marcar un ítem como FAILED. */
export const MAX_PREPARATION_ATTEMPTS = 5;

export function isIngredientName(value: string): value is IngredientName {
  return (INGREDIENTS as readonly string[]).includes(value);
}
