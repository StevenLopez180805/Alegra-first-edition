import { usePreparations } from "../api/queries";
import type { ItemStatus } from "../api/types";
import { Card, RefreshIndicator } from "../components/Card";
import { QueryState } from "../components/QueryState";
import { ITEM_STATUS_META } from "../lib/format";
import { ItemRow } from "./ItemRow";
import { useRecipeNames } from "./useRecipeNames";

const ACTIVE_STATUSES: ItemStatus[] = ["PREPARING", "WAITING_INGREDIENTS", "PENDING"];

export function PreparationsSection() {
  const query = usePreparations();
  const recipeName = useRecipeNames();

  return (
    <Card
      title="Platos en cocina"
      description="Platos en cola, en preparación o esperando ingredientes."
      aside={<RefreshIndicator active={query.isFetching} />}
    >
      <QueryState
        query={query}
        isEmpty={(items) => items.length === 0}
        emptyMessage="No hay platos en cocina. Pide platos para empezar."
      >
        {(items) => (
          <>
            <ul aria-label="Resumen por estado" className="mb-3 flex flex-wrap gap-2 text-xs">
              {ACTIVE_STATUSES.map((status) => (
                <li key={status} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-800">
                  {ITEM_STATUS_META[status].label}:{" "}
                  <strong>{items.filter((item) => item.status === status).length}</strong>
                </li>
              ))}
            </ul>
            <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
              {items.map((item) => (
                <ItemRow key={item.itemId} item={item} recipeName={recipeName(item.recipeId)} showOrder />
              ))}
            </ul>
          </>
        )}
      </QueryState>
    </Card>
  );
}
