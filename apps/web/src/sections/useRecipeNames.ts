import { useMemo } from "react";
import { useRecipes } from "../api/queries";

/** Nombre legible de cada recipeId (los ítems solo guardan el id). */
export function useRecipeNames(): (recipeId: string | undefined) => string | undefined {
  const { data } = useRecipes();
  const names = useMemo(() => new Map(data?.map((recipe) => [recipe.recipeId, recipe.name])), [data]);
  return (recipeId) => (recipeId === undefined ? undefined : (names.get(recipeId) ?? recipeId));
}
