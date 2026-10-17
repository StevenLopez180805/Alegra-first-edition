import { computeShortages, type StockSnapshot } from "@jag/inventory";
import type { IngredientName, Logger, OrderItem, PurchaseAttempt, Recipe } from "@jag/shared";

export type DeliveryResult = "DELIVERED" | "INSUFFICIENT_STOCK" | "ALREADY_DONE";
export type PrepareOutcome = "DELIVERED" | "ALREADY_DONE" | "WAITING_INGREDIENTS" | "FAILED" | "SKIPPED";

/** Adaptadores de dominio que usa el orquestador (reales en adapters.ts, falsos en tests). */
export interface PreparationDeps {
  getItem(orderId: string, itemId: string): Promise<OrderItem | undefined>;
  /** Pasa a PREPARING e incrementa `attempts`; undefined si el ítem ya está en estado final. */
  startAttempt(item: OrderItem): Promise<OrderItem | undefined>;
  /** Persiste la receta solo si el ítem aún no tiene una; devuelve la receta vigente. */
  assignRecipe(item: OrderItem, recipeId: string): Promise<string>;
  getRecipe(recipeId: string): Promise<Recipe | undefined>;
  pickRecipe(): Recipe;
  getStock(): Promise<StockSnapshot>;
  /** Consumo de ingredientes + DELIVERED en una única transacción. */
  tryDeliver(item: OrderItem, recipe: Recipe): Promise<DeliveryResult>;
  purchase(ingredient: IngredientName, itemId: string): Promise<PurchaseAttempt>;
  markWaiting(item: OrderItem, reason: string): Promise<void>;
  markFailed(item: OrderItem, reason: string): Promise<void>;
  maxAttempts: number;
  /** Compras como máximo por ingrediente faltante en cada intento. */
  maxPurchasesPerIngredient: number;
  log: Logger;
}

/**
 * Algoritmo por ítem (PLANNING.md §5). Idempotente: un mensaje repetido sobre un
 * ítem ya entregado no tiene efectos secundarios.
 */
export async function prepareItem(orderId: string, itemId: string, deps: PreparationDeps): Promise<PrepareOutcome> {
  const log = deps.log.child({ orderId, itemId });

  const stored = await deps.getItem(orderId, itemId);
  if (!stored) {
    log.warn("Ítem inexistente; se descarta el mensaje");
    return "SKIPPED";
  }
  if (stored.status === "DELIVERED" || stored.status === "FAILED") return "ALREADY_DONE";

  const started = await deps.startAttempt(stored);
  if (!started) return "ALREADY_DONE";

  const recipeId = started.recipeId ?? (await deps.assignRecipe(started, deps.pickRecipe().recipeId));
  const item: OrderItem = { ...started, recipeId };
  const recipe = await deps.getRecipe(recipeId);
  if (!recipe) {
    await deps.markFailed(item, `Receta inexistente: ${recipeId}`);
    return "FAILED";
  }

  const first = await deps.tryDeliver(item, recipe);
  if (first !== "INSUFFICIENT_STOCK") return first;

  await restockShortages(item, recipe, deps, log);

  const second = await deps.tryDeliver(item, recipe);
  if (second !== "INSUFFICIENT_STOCK") return second;

  if (item.attempts >= deps.maxAttempts) {
    await deps.markFailed(item, `Ingredientes insuficientes tras ${item.attempts} intentos`);
    log.warn("Ítem marcado FAILED", { attempts: item.attempts });
    return "FAILED";
  }
  await deps.markWaiting(item, "Ingredientes insuficientes; se reintentará");
  return "WAITING_INGREDIENTS";
}

async function restockShortages(item: OrderItem, recipe: Recipe, deps: PreparationDeps, log: Logger): Promise<void> {
  const shortages = computeShortages(recipe, await deps.getStock());
  // Compras secuenciales: la API no garantiza la cantidad pedida y no expone idempotencia.
  for (const shortage of shortages) {
    let missing = shortage.quantity;
    for (let call = 0; missing > 0 && call < deps.maxPurchasesPerIngredient; call++) {
      const purchase = await deps.purchase(shortage.name, item.itemId);
      log.info("Compra en mercado", { ingredient: shortage.name, status: purchase.status, quantitySold: purchase.quantitySold });
      if (purchase.status !== "SOLD") break;
      missing -= purchase.quantitySold;
    }
  }
}
