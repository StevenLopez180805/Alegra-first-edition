/** Intervalo de polling: el backend prepara los platos de forma asíncrona (SQS). */
export const POLL_INTERVAL_MS = 4_000;

/** Stock igual o menor a este valor se resalta como bajo. */
export const LOW_STOCK_THRESHOLD = 2;

const DEFAULT_MAX_ORDER_ITEMS = 100;

/** Debe coincidir con el parámetro MaxOrderItems del backend; el backend valida de todas formas. */
export function maxOrderItems(): number {
  const value = Number(import.meta.env.VITE_MAX_ORDER_ITEMS);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MAX_ORDER_ITEMS;
}
