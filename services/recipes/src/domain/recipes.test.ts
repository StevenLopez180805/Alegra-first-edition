import { isIngredientName } from "@jag/shared";
import { describe, expect, it } from "vitest";
import { RECIPES } from "./recipes.data";
import { pickRandomRecipe } from "./select";

describe("catálogo de recetas", () => {
  it("tiene exactamente seis recetas con ids únicos", () => {
    expect(RECIPES).toHaveLength(6);
    expect(new Set(RECIPES.map((r) => r.recipeId)).size).toBe(6);
  });

  it("solo usa ingredientes permitidos con cantidades enteras positivas", () => {
    for (const recipe of RECIPES) {
      expect(recipe.ingredients.length).toBeGreaterThan(0);
      for (const ingredient of recipe.ingredients) {
        expect(isIngredientName(ingredient.name)).toBe(true);
        expect(Number.isInteger(ingredient.quantity) && ingredient.quantity > 0).toBe(true);
      }
    }
  });
});

describe("pickRandomRecipe", () => {
  it("cubre los extremos del rango aleatorio", () => {
    expect(pickRandomRecipe(RECIPES, () => 0)).toBe(RECIPES[0]);
    expect(pickRandomRecipe(RECIPES, () => 0.9999)).toBe(RECIPES[5]);
  });
});
