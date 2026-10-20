import type { Recipe } from "@jag/shared";
import { RECIPES } from "./recipes.data";

/**
 * Elige una receta al azar. El resultado se persiste en el ítem y con eso un reintento nunca cambia la receta asignada.
 */
export function pickRandomRecipe(recipes: readonly Recipe[] = RECIPES, random: () => number = Math.random): Recipe {
  if (recipes.length === 0) throw new Error("No hay recetas disponibles");
  const index = Math.floor(random() * recipes.length);
  return recipes[Math.min(index, recipes.length - 1)]!;
}
