import type { Logger, OrderItem, PrepareOrderItemMessage } from "@jag/shared";

export interface OutboxRef {
  orderId: string;
  createdAt: string;
}

export interface ReconcileDeps {
  listStaleOutbox(olderThan: string, limit: number): Promise<OutboxRef[]>;
  listPendingItems(orderId: string): Promise<OrderItem[]>;
  /** Devuelve los itemId que no se pudieron encolar. */
  enqueue(messages: PrepareOrderItemMessage[]): Promise<string[]>;
  clearOutbox(entry: OutboxRef): Promise<void>;
  log: Logger;
  now?: () => Date;
}

export interface ReconcileOptions {
  /** Margen para no competir con un POST /orders que todavía está encolando. */
  graceSeconds: number;
  /** Pedidos revisados por ejecución. */
  batchLimit: number;
}

export const DEFAULT_RECONCILE_OPTIONS: ReconcileOptions = { graceSeconds: 120, batchLimit: 25 };

export interface ReconcileSummary {
  ordersChecked: number;
  itemsRequeued: number;
  ordersCleared: number;
  ordersPending: number;
}

/**
 * reencola los platos PENDING de pedidos con el encolado no confirmado
 */
export async function reconcilePendingOrders(
  deps: ReconcileDeps,
  options: ReconcileOptions = DEFAULT_RECONCILE_OPTIONS,
): Promise<ReconcileSummary> {
  const now = deps.now?.() ?? new Date();
  const olderThan = new Date(now.getTime() - options.graceSeconds * 1000).toISOString();
  const entries = await deps.listStaleOutbox(olderThan, options.batchLimit);
  const summary: ReconcileSummary = { ordersChecked: entries.length, itemsRequeued: 0, ordersCleared: 0, ordersPending: 0 };

  for (const entry of entries) {
    const log = deps.log.child({ orderId: entry.orderId });
    try {
      const pending = await deps.listPendingItems(entry.orderId);
      const messages = pending.map(
        (item): PrepareOrderItemMessage => ({ type: "PrepareOrderItem", orderId: item.orderId, itemId: item.itemId }),
      );
      const failed = messages.length > 0 ? await deps.enqueue(messages) : [];
      summary.itemsRequeued += messages.length - failed.length;

      if (failed.length > 0) {
        summary.ordersPending++;
        log.warn("Reconciliación incompleta; se reintentará en el próximo barrido", { itemIds: failed });
        continue;
      }
      await deps.clearOutbox(entry);
      summary.ordersCleared++;
      if (messages.length > 0) log.info("Platos reencolados por reconciliación", { count: messages.length });
    } catch (error) {
      summary.ordersPending++;
      log.error("Error reconciliando pedido", { error: String(error) });
    }
  }
  return summary;
}
