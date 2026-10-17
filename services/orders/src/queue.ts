import { SendMessageBatchCommand, SQSClient } from "@aws-sdk/client-sqs";
import type { PrepareOrderItemMessage } from "@jag/shared";

const SQS_BATCH_SIZE = 10;
let sqs: SQSClient | undefined;

function queueUrl(): string {
  const url = process.env.QUEUE_URL;
  if (!url) throw new Error("Falta la variable de entorno QUEUE_URL");
  return url;
}

/** Encola un mensaje por plato. Devuelve los itemId que no se pudieron encolar. */
export async function enqueuePreparations(messages: PrepareOrderItemMessage[]): Promise<string[]> {
  sqs ??= new SQSClient({});
  const failed: string[] = [];
  for (let start = 0; start < messages.length; start += SQS_BATCH_SIZE) {
    const chunk = messages.slice(start, start + SQS_BATCH_SIZE);
    const result = await sqs.send(
      new SendMessageBatchCommand({
        QueueUrl: queueUrl(),
        Entries: chunk.map((message, index) => ({ Id: String(index), MessageBody: JSON.stringify(message) })),
      }),
    );
    for (const failure of result.Failed ?? []) {
      const message = chunk[Number(failure.Id)];
      if (message) failed.push(message.itemId);
    }
  }
  return failed;
}
