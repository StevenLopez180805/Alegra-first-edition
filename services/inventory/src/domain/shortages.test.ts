import type { Recipe } from "@jag/shared";
import { describe, expect, it } from "vitest";
import { computeShortages } from "./shortages";

const recipe: Recipe = {
  recipeId: "test",
  name: "Test",
  ingredients: [
    { name: "potato", quantity: 3 },
    { name: "cheese", quantity: 2 },
  ],
};

describe("computeShortages", () => {
  it("no reporta faltantes cuando hay stock suficiente", () => {
    expect(computeShortages(recipe, { potato: 3, cheese: 5 })).toEqual([]);
  });

  it("reporta solo las unidades que faltan", () => {
    expect(computeShortages(recipe, { potato: 1, cheese: 2 })).toEqual([{ name: "potato", quantity: 2 }]);
  });

  it("trata ingredientes ausentes como stock 0", () => {
    expect(computeShortages(recipe, {})).toEqual([
      { name: "potato", quantity: 3 },
      { name: "cheese", quantity: 2 },
    ]);
  });
});
