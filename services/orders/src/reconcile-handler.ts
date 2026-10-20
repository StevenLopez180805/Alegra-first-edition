import { createLogger } from "@jag/shared";
import { reconcilePendingOrders, type ReconcileSummary } from "./domain/reconcile";
import { enqueuePreparations } from "./queue";
import { clearOutbox, listPendingItems, listStaleOutbox } from "./repository";

const log = createLogger("orders-reconcile");

/** Lambda programada (EventBridge, cada 5 min): barrido del outbox de encolado */
export async function handler(): Promise<ReconcileSummary> {
  const summary = await reconcilePendingOrders({
    listStaleOutbox,
    listPendingItems,
    enqueue: enqueuePreparations,
    clearOutbox,
    log,
  });
  if (summary.ordersChecked > 0) log.info("Barrido de reconciliación", { ...summary });
  return summary;
}
