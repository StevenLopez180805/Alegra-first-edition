import { usePurchases } from "../api/queries";
import { PurchaseStatusBadge } from "../components/Badge";
import { RefreshIndicator } from "../components/Card";
import { QueryState } from "../components/QueryState";
import { formatDateTime, ingredientLabel, shortId } from "../lib/format";

export function PurchasesSection() {
  const query = usePurchases();

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Compras automáticas en la plaza de mercado. El mercado puede vender 0 unidades si no tiene existencias.
        </p>
        <RefreshIndicator active={query.isFetching} />
      </div>
      <QueryState
        query={query}
        isEmpty={(purchases) => purchases.length === 0}
        emptyMessage="Aún no se ha comprado nada: la bodega ha tenido ingredientes suficientes."
      >
        {(purchases) => (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                <tr>
                  <th scope="col" className="px-3 py-2">Fecha</th>
                  <th scope="col" className="px-3 py-2">Ingrediente</th>
                  <th scope="col" className="px-3 py-2 text-right">Unidades vendidas</th>
                  <th scope="col" className="px-3 py-2">Resultado</th>
                  <th scope="col" className="px-3 py-2">Plato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map((purchase) => (
                  <tr key={purchase.purchaseId}>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-800">{formatDateTime(purchase.createdAt)}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{ingredientLabel(purchase.ingredient)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{purchase.quantitySold}</td>
                    <td className="px-3 py-2">
                      <PurchaseStatusBadge status={purchase.status} />
                      {purchase.error && <p className="mt-1 max-w-xs text-xs text-red-800">{purchase.error}</p>}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-700">{shortId(purchase.itemId)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>
    </div>
  );
}
