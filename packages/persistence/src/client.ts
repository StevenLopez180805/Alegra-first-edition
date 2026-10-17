import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

let documentClient: DynamoDBDocumentClient | undefined;

/** Cliente reutilizado entre invocaciones de la misma instancia Lambda. */
export function getDocumentClient(): DynamoDBDocumentClient {
  documentClient ??= DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });
  return documentClient;
}

export function tableName(): string {
  const name = process.env.TABLE_NAME;
  if (!name) throw new Error("Falta la variable de entorno TABLE_NAME");
  return name;
}

export function nowIso(): string {
  return new Date().toISOString();
}
