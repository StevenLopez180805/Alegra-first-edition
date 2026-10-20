import type { IngredientName } from "@jag/shared";

export const DEFAULT_MARKET_URL = "https://recruitment.alegra.com/api/farmers-market/buy";
export const DEFAULT_MARKET_TIMEOUT_MS = 5_000;

export type MarketResult =
  | { kind: "sold"; quantitySold: number }
  | { kind: "unavailable" }
  | { kind: "error"; error: string };

/**
 * Interpreta la respuesta del mercado. Solo un entero positivo cuenta como venta;
 * cualquier otra cosa es error y nunca se inventa una cantidad.
 */
export function parseMarketResponse(body: unknown): MarketResult {
  const quantitySold = (body as { quantitySold?: unknown } | null)?.quantitySold;
  if (typeof quantitySold !== "number" || !Number.isInteger(quantitySold) || quantitySold < 0) {
    return { kind: "error", error: `Respuesta inválida del mercado: ${JSON.stringify(body)}` };
  }
  return quantitySold === 0 ? { kind: "unavailable" } : { kind: "sold", quantitySold };
}

export interface MarketClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Una sola llamada al mercado, con timeout. Ojo: si hay timeout la compra pudo
 * ejecutarse sin que conozcamos el resultado (sin idempotencia en el mercado);
 * se registra como error y no se suma stock. Ver PLANNING.md §5.
 */
export async function buyFromMarket(ingredient: IngredientName, options: MarketClientOptions = {}): Promise<MarketResult> {
  const {
    baseUrl = process.env.MARKET_URL ?? DEFAULT_MARKET_URL,
    timeoutMs = DEFAULT_MARKET_TIMEOUT_MS,
    fetchImpl = fetch,
  } = options;

  const url = new URL(baseUrl);
  url.searchParams.set("ingredient", ingredient);

  try {
    const response = await fetchImpl(url, { method: "GET", signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return { kind: "error", error: `HTTP ${response.status} del mercado` };
    return parseMarketResponse(await response.json());
  } catch (error) {
    const isTimeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return { kind: "error", error: isTimeout ? `Timeout tras ${timeoutMs} ms` : String(error) };
  }
}
