import type { OrderItem } from "../api/types";
import { ItemStatusBadge } from "../components/Badge";
import { shortId } from "../lib/format";

interface ItemRowProps {
  item: OrderItem;
  recipeName: string | undefined;
  showOrder?: boolean;
}

/** Un plato: receta, estado, intentos y motivo de espera o fallo. */
export function ItemRow({ item, recipeName, showOrder = false }: ItemRowProps) {
  const showReason = item.lastError && (item.status === "WAITING_INGREDIENTS" || item.status === "FAILED");
  return (
    <li className="rounded-lg border border-slate-200 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-slate-900">
          {recipeName ?? <span className="italic text-slate-600">Asignando receta…</span>}
        </p>
        <ItemStatusBadge status={item.status} />
      </div>
      <p className="mt-1 text-xs text-slate-600">
        Plato <span className="font-mono">{shortId(item.itemId)}</span>
        {showOrder && (
          <>
            {" · "}Pedido <span className="font-mono">{shortId(item.orderId)}</span>
          </>
        )}
        {" · "}
        {item.attempts} {item.attempts === 1 ? "intento" : "intentos"}
      </p>
      {showReason && <p className="mt-1.5 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">{item.lastError}</p>}
    </li>
  );
}
