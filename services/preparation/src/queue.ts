import { ChangeMessageVisibilityCommand, SQSClient } from "@aws-sdk/client-sqs";

let sqs: SQSClient | undefined;

function queueUrl(): string {
  const url = process.env.QUEUE_URL;
  if (!url) throw new Error("Falta la variable de entorno QUEUE_URL");
  return url;
}

/** Programa la próxima entrega del mensaje dentro de `seconds` (el mensaje sigue en vuelo). */
export async function delayRedelivery(receiptHandle: string, seconds: number): Promise<void> {
  sqs ??= new SQSClient({});
  await sqs.send(
    new ChangeMessageVisibilityCommand({ QueueUrl: queueUrl(), ReceiptHandle: receiptHandle, VisibilityTimeout: seconds }),
  );
}
