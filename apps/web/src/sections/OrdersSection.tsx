import { useCallback, useState, type ReactNode } from "react";
import { useOrder, useOrders } from "../api/queries";
import { OrderStatusBadge } from "../components/Badge";
import { RefreshIndicator } from "../components/Card";
import { Modal } from "../components/Modal";
import { QueryState } from "../components/QueryState";
import { formatDateTime, shortId } from "../lib/format";
import { ItemRow } from "./ItemRow";
import { useRecipeNames } from "./useRecipeNames";

export function OrdersSection() {
  const query = useOrders();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const close = useCallback(() => setSelectedId(null), []);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-slate-600">Últimos 50 pedidos. Selecciona uno para ver sus platos.</p>
        <RefreshIndicator active={query.isFetching} />
      </div>
      <QueryState query={query} isEmpty={(orders) => orders.length === 0} emptyMessage="Todavía no hay pedidos.">
        {(orders) => (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                <tr>
                  <th scope="col" className="px-3 py-2">Fecha</th>
                  <th scope="col" className="px-3 py-2">Pedido</th>
                  <th scope="col" className="px-3 py-2 text-right">Platos</th>
                  <th scope="col" className="px-3 py-2 text-right">Entregados</th>
                  <th scope="col" className="px-3 py-2 text-right">Fallidos</th>
                  <th scope="col" className="px-3 py-2">Estado</th>
                  <th scope="col" className="px-3 py-2"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <tr key={order.orderId} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedId(order.orderId)}>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-800">{formatDateTime(order.createdAt)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-700">{shortId(order.orderId)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{order.quantity}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{order.deliveredCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{order.failedCount}</td>
                    <td className="px-3 py-2"><OrderStatusBadge status={order.status} /></td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedId(order.orderId);
                        }}
                        aria-label={`Ver detalle del pedido ${shortId(order.orderId)}`}
                        className="rounded-md px-2 py-1 text-sm font-medium text-sky-800 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-sky-600"
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>
      {selectedId && <OrderDetailModal orderId={selectedId} onClose={close} />}
    </div>
  );
}

function OrderDetailModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const query = useOrder(orderId);
  const recipeName = useRecipeNames();

  return (
    <Modal title={`Pedido ${shortId(orderId)}`} onClose={onClose}>
      <QueryState query={query} emptyMessage="" skeletonRows={4}>
        {(order) => (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Stat label="Estado" value={<OrderStatusBadge status={order.status} />} />
              <Stat label="Platos" value={order.quantity} />
              <Stat label="Entregados" value={order.deliveredCount} />
              <Stat label="Fallidos" value={order.failedCount} />
            </dl>
            <p className="text-xs text-slate-600">
              Creado: {formatDateTime(order.createdAt)} · Actualizado: {formatDateTime(order.updatedAt)}
            </p>
            <ul className="space-y-2" aria-label="Platos del pedido">
              {order.items.map((item) => (
                <ItemRow key={item.itemId} item={item} recipeName={recipeName(item.recipeId)} />
              ))}
            </ul>
          </div>
        )}
      </QueryState>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-xs text-slate-600">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}
