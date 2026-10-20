export const RETRY_BASE_SECONDS = 15;
export const RETRY_MAX_SECONDS = 300;

/**
 * Espera antes de que SQS vuelva a entregar un plato: backoff exponencial con "equal jitter"
 * (la mitad fija y la otra mitad al azar) para no reintentar todos los platos a la vez.
 * Con los valores por defecto: ~15 s, 30 s, 60 s, 120 s, 240 s y luego 300 s como máximo.
 *
 * @param receiveCount ApproximateReceiveCount del mensaje (1 en la primera entrega).
 */
export function retryDelaySeconds(
  receiveCount: number,
  random: () => number = Math.random,
  baseSeconds = RETRY_BASE_SECONDS,
  maxSeconds = RETRY_MAX_SECONDS,
): number {
  const count = Number.isFinite(receiveCount) ? Math.floor(receiveCount) : 1;
  const exponent = Math.max(0, count - 1);
  const ceiling = Math.min(maxSeconds, baseSeconds * 2 ** exponent);
  const half = ceiling / 2;
  return Math.max(1, Math.round(half + random() * half));
}
