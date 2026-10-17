import type { SQSBatchResponse, SQSEvent } from "aws-lambda";
import { createLogger, parsePrepareOrderItem } from "@jag/shared";
import { createPreparationDeps } from "./adapters";
import { prepareItem } from "./domain/prepare-item";

const deps = createPreparationDeps();
const log = createLogger("preparation");

/**
 * Worker SQS con ReportBatchItemFailures: los ítems en espera o con error vuelven a la
 * cola tras el visibility timeout; tras maxReceiveCount pasan a la DLQ.
 */
export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];

  for (const record of event.Records) {
    try {
      const { orderId, itemId } = parsePrepareOrderItem(record.body);
      const outcome = await prepareItem(orderId, itemId, deps);
      log.info("Resultado de preparación", { orderId, itemId, outcome, receiveCount: record.attributes.ApproximateReceiveCount });
      // TODO(BUY-02): backoff controlado con ChangeMessageVisibility en lugar del visibility timeout fijo.
      if (outcome === "WAITING_INGREDIENTS") batchItemFailures.push({ itemIdentifier: record.messageId });
    } catch (error) {
      log.error("Error procesando mensaje", { messageId: record.messageId, error: String(error) });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}
