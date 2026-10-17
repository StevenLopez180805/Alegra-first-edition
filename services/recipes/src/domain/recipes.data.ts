import type { Recipe } from "@jag/shared";

/** Seis recetas precargadas por el seed; solo usan ingredientes permitidos. */
export const RECIPES: readonly Recipe[] = [
  {
    recipeId: "chicken-salad",
    name: "Ensalada de pollo",
    ingredients: [
      { name: "chicken", quantity: 1 },
      { name: "lettuce", quantity: 2 },
      { name: "tomato", quantity: 1 },
      { name: "lemon", quantity: 1 },
    ],
  },
  {
    recipeId: "cheeseburger",
    name: "Hamburguesa con queso",
    ingredients: [
      { name: "meat", quantity: 1 },
      { name: "cheese", quantity: 1 },
      { name: "lettuce", quantity: 1 },
      { name: "tomato", quantity: 1 },
      { name: "onion", quantity: 1 },
      { name: "ketchup", quantity: 1 },
    ],
  },
  {
    recipeId: "chicken-rice",
    name: "Arroz con pollo",
    ingredients: [
      { name: "rice", quantity: 2 },
      { name: "chicken", quantity: 1 },
      { name: "onion", quantity: 1 },
      { name: "tomato", quantity: 1 },
    ],
  },
  {
    recipeId: "potato-gratin",
    name: "Papas gratinadas",
    ingredients: [
      { name: "potato", quantity: 3 },
      { name: "cheese", quantity: 2 },
      { name: "onion", quantity: 1 },
    ],
  },
  {
    recipeId: "meat-and-rice",
    name: "Carne con arroz",
    ingredients: [
      { name: "meat", quantity: 1 },
      { name: "rice", quantity: 1 },
      { name: "potato", quantity: 1 },
      { name: "onion", quantity: 1 },
    ],
  },
  {
    recipeId: "fresh-salad",
    name: "Ensalada fresca",
    ingredients: [
      { name: "lettuce", quantity: 2 },
      { name: "tomato", quantity: 2 },
      { name: "onion", quantity: 1 },
      { name: "lemon", quantity: 1 },
      { name: "cheese", quantity: 1 },
    ],
  },
];
