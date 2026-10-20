import { useInventory } from "../api/queries";
import { Badge } from "../components/Badge";
import { RefreshIndicator } from "../components/Card";
import { QueryState } from "../components/QueryState";
import { LOW_STOCK_THRESHOLD } from "../config";
import { ingredientLabel } from "../lib/format";

type StockLevel = "empty" | "low" | "ok";

const LEVEL_CLASSES: Record<StockLevel, string> = {
  empty: "border-red-300 bg-red-50",
  low: "border-amber-300 bg-amber-50",
  ok: "border-slate-200 bg-white",
};

function stockLevel(stock: number): StockLevel {
  if (stock <= 0) return "empty";
  return stock <= LOW_STOCK_THRESHOLD ? "low" : "ok";
}

export function InventorySection() {
  const query = useInventory();

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-slate-600">Unidades disponibles en bodega.</p>
        <RefreshIndicator active={query.isFetching} />
      </div>
      <QueryState
        query={query}
        isEmpty={(ingredients) => ingredients.length === 0}
        emptyMessage="La bodega no tiene ingredientes registrados. Ejecuta el seed del backend."
        skeletonRows={5}
      >
        {(ingredients) => (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {ingredients.map((ingredient) => {
              const level = stockLevel(ingredient.stock);
              const empty = level === "empty";
              const low = level === "low";
              return (
                <li key={ingredient.name} className={`rounded-lg border px-3 py-3 ${LEVEL_CLASSES[level]}`}>
                  <p className="text-sm font-medium text-slate-800">{ingredientLabel(ingredient.name)}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                    {ingredient.stock}
                    <span className="sr-only"> unidades</span>
                  </p>
                  <div className="mt-1 min-h-5">
                    {empty && <Badge label="Agotado" tone="danger" />}
                    {low && <Badge label="Stock bajo" tone="warning" />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </QueryState>
    </div>
  );
}
