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
  savePurchase: (purchase: PurchaseAttempt) => Promise<void>;
  restock: (ingredient: IngredientName, quantity: number, purchaseId: string) => Promise<boolean>;
  now?: () => string;
  newId?: () => string;
}

/**
 * Compra un ingrediente para un ítem: registra el intento y repone solo lo
 * confirmado por `quantitySold`. Devuelve el intento registrado.
 */
export async function procureIngredient(ingredient: IngredientName, itemId: string, deps: ProcureDeps): Promise<PurchaseAttempt> {
  const { now = () => new Date().toISOString(), newId = randomUUID } = deps;
  const result = await deps.buy(ingredient);

  const purchase: PurchaseAttempt = {
    purchaseId: newId(),
    itemId,
    ingredient,
    quantitySold: result.kind === "sold" ? result.quantitySold : 0,
    status: STATUS_BY_RESULT[result.kind],
    createdAt: now(),
    ...(result.kind === "error" ? { error: result.error } : {}),
  };

  // TODO(BUY-02): registrar el intento antes de llamar al mercado para no perder trazabilidad
  // si la Lambda muere entre la respuesta y la escritura.
  await deps.savePurchase(purchase);
  if (purchase.status === "SOLD") {
    await deps.restock(ingredient, purchase.quantitySold, purchase.purchaseId);
  }
  return purchase;
}
