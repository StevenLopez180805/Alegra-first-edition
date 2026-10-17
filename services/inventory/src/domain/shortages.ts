import type { IngredientName, Recipe, RecipeIngredient } from "@jag/shared";

export type StockSnapshot = Partial<Record<IngredientName, number>>;

/** Ingredientes (y unidades) que faltan para preparar `recipe` con el stock dado. */
export function computeShortages(recipe: Recipe, stock: StockSnapshot): RecipeIngredient[] {
  return recipe.ingredients
    .map(({ name, quantity }) => ({ name, quantity: quantity - (stock[name] ?? 0) }))
    .filter((shortage) => shortage.quantity > 0);
}
