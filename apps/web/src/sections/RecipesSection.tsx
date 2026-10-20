import { useRecipes } from "../api/queries";
import { QueryState } from "../components/QueryState";
import { ingredientLabel } from "../lib/format";

export function RecipesSection() {
  const query = useRecipes();

  return (
    <div>
      <p className="mb-3 text-sm text-slate-600">La cocina elige una de estas recetas al azar para cada plato.</p>
      <QueryState
        query={query}
        isEmpty={(recipes) => recipes.length === 0}
        emptyMessage="No hay recetas registradas. Ejecuta el seed del backend."
      >
        {(recipes) => (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map((recipe) => (
              <li key={recipe.recipeId} className="rounded-lg border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-900">{recipe.name}</h3>
                <ul className="mt-2 space-y-1 text-sm text-slate-700" aria-label={`Ingredientes de ${recipe.name}`}>
                  {recipe.ingredients.map((ingredient) => (
                    <li key={ingredient.name} className="flex justify-between gap-2">
                      <span>{ingredientLabel(ingredient.name)}</span>
                      <span className="tabular-nums text-slate-600">× {ingredient.quantity}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </div>
  );
}
