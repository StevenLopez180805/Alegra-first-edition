import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function parseJsonBody(event: APIGatewayProxyEventV2): unknown {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "El cuerpo debe ser JSON válido");
  }
}

export type RouteHandler = (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>;

/** Enrutador mínimo sobre `routeKey` de HTTP API (p. ej. "GET /orders/{orderId}"), sin frameworks. */
export function createRouter(routes: Record<string, RouteHandler>): RouteHandler {
  return async (event) => {
    const route = routes[event.routeKey];
    if (!route) return json(404, { message: `Ruta no encontrada: ${event.routeKey}` });
    try {
      return await route(event);
    } catch (error) {
      if (error instanceof HttpError) return json(error.statusCode, { message: error.message });
      console.error(JSON.stringify({ level: "error", routeKey: event.routeKey, error: String(error) }));
      return json(500, { message: "Error interno" });
    }
  };
}

/** Lee `?limit=` acotado para evitar consultas sin límite. */
export function parseLimit(event: APIGatewayProxyEventV2, fallback = 50, max = 200): number {
  const value = Number(event.queryStringParameters?.limit);
  if (!Number.isInteger(value) || value < 1) return fallback;
  return Math.min(value, max);
}
