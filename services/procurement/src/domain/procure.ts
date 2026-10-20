import { randomUUID } from "node:crypto";
import type { IngredientName, PurchaseAttempt, PurchaseStatus } from "@jag/shared";
import type { MarketResult } from "./market-client";

const STATUS_BY_RESULT: Record<MarketResult["kind"], PurchaseStatus> = {
  sold: "SOLD",
  unavailable: "UNAVAILABLE",
  error: "ERROR",
};

export interface ProcureDeps {
  buy: (ingredient: IngredientName) => Promise<MarketResult>;
  /** Registra el intento en estado REQUESTED, antes de llamar al mercado. */
  savePurchase: (purchase: PurchaseAttempt) => Promise<void>;
  /**
   * Cierra el intento con su resultado. Si es SOLD, la reposición de stock va en la misma
   * transacción. Devuelve false si el intento ya estaba cerrado.
   */
  completePurchase: (purchase: PurchaseAttempt) => Promise<boolean>;
  now?: () => string;
  newId?: () => string;
}

/**
 * Compra un ingrediente para un ítem. El intento se registra antes de llamar al mercado, así
 * queda rastro aunque la Lambda muera a mitad de la compra (queda en REQUESTED: resultado
 * incierto). Solo se repone lo confirmado por `quantitySold`. Devuelve el intento ya cerrado.
 */
export async function procureIngredient(ingredient: IngredientName, itemId: string, deps: ProcureDeps): Promise<PurchaseAttempt> {
  const { now = () => new Date().toISOString(), newId = randomUUID } = deps;

  const requested: PurchaseAttempt = {
    purchaseId: newId(),
    itemId,
    ingredient,
    quantitySold: 0,
    status: "REQUESTED",
    createdAt: now(),
  };
  await deps.savePurchase(requested);

  const result = await deps.buy(ingredient);
  const completed: PurchaseAttempt = {
    ...requested,
    quantitySold: result.kind === "sold" ? result.quantitySold : 0,
    status: STATUS_BY_RESULT[result.kind],
    completedAt: now(),
    ...(result.kind === "error" ? { error: result.error } : {}),
  };
  await deps.completePurchase(completed);
  return completed;
}
