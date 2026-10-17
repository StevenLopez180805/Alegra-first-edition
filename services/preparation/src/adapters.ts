import { getStockSnapshot } from "@jag/inventory";
import { purchaseIngredient } from "@jag/procurement";
import { getRecipe, pickRandomRecipe } from "@jag/recipes";
import { createLogger, MAX_PREPARATION_ATTEMPTS } from "@jag/shared";
import type { PreparationDeps } from "./domain/prepare-item";
import * as repository from "./repository";

/** Conecta el orquestador con los servicios reales (código compartido del monorepo, sin Lambda→Lambda). */
export function createPreparationDeps(): PreparationDeps {
  return {
    getItem: repository.getItem,
    startAttempt: repository.startAttempt,
    assignRecipe: repository.assignRecipe,
    tryDeliver: repository.tryDeliver,
    markWaiting: repository.markWaiting,
    markFailed: repository.markFailed,
    getRecipe,
    pickRecipe: () => pickRandomRecipe(),
    getStock: getStockSnapshot,
    purchase: purchaseIngredient,
    maxAttempts: Number(process.env.MAX_PREPARATION_ATTEMPTS) || MAX_PREPARATION_ATTEMPTS,
    maxPurchasesPerIngredient: 3,
    log: createLogger("preparation"),
  };
}
