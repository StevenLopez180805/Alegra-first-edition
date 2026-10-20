import type { SQSBatchResponse, SQSEvent, SQSRecord } from "aws-lambda";
import { createLogger, parsePrepareOrderItem } from "@jag/shared";
import { createPreparationDeps } from "./adapters";
import { retryDelaySeconds } from "./domain/backoff";
import { prepareItem } from "./domain/prepare-item";
import { delayRedelivery } from "./queue";

const deps = createPreparationDeps();
const log = createLogger("preparation");

/**
 * Worker SQS con ReportBatchItemFailures: los ítems en espera o con error vuelven a la cola
 * con backoff exponencial (ChangeMessageVisibility); tras maxReceiveCount pasan a la DLQ.
 */
export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];

  for (const record of event.Records) {
    try {
      const { orderId, itemId } = parsePrepareOrderItem(record.body);
      const outcome = await prepareItem(orderId, itemId, deps);
      log.info("Resultado de preparación", { orderId, itemId, outcome, receiveCount: record.attributes.ApproximateReceiveCount });
      if (outcome === "WAITING_INGREDIENTS") {
        await scheduleRetry(record);
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    } catch (error) {
      log.error("Error procesando mensaje", { messageId: record.messageId, error: String(error) });
      await scheduleRetry(record);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}

/** Si no se puede cambiar la visibilidad, el mensaje vuelve igual al vencer el visibility timeout de la cola. */
async function scheduleRetry(record: SQSRecord): Promise<void> {
  const receiveCount = Number(record.attributes.ApproximateReceiveCount);
  const delaySeconds = retryDelaySeconds(receiveCount);
  try {
    await delayRedelivery(record.receiptHandle, delaySeconds);
    log.info("Reintento programado", { messageId: record.messageId, receiveCount, delaySeconds });
  } catch (error) {
    log.warn("No se pudo programar el backoff; se usa el visibility timeout de la cola", {
      messageId: record.messageId,
      error: String(error),
    });
  }
}
