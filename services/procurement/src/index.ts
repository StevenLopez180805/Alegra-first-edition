// Contrato de dominio que consume el worker de preparación (adaptador Procurement).
import { restock } from "@jag/inventory";
import type { IngredientName, PurchaseAttempt } from "@jag/shared";
import { buyFromMarket } from "./domain/market-client";
import { procureIngredient } from "./domain/procure";
import { savePurchase } from "./repository";

export { buyFromMarket, parseMarketResponse, type MarketResult } from "./domain/market-client";
export { procureIngredient, type ProcureDeps } from "./domain/procure";
export { listPurchases, savePurchase } from "./repository";

/** Compra con las dependencias reales (mercado + DynamoDB). */
export function purchaseIngredient(ingredient: IngredientName, itemId: string): Promise<PurchaseAttempt> {
  return procureIngredient(ingredient, itemId, {
    buy: (name) => buyFromMarket(name),
    savePurchase,
    restock,
  });
}
