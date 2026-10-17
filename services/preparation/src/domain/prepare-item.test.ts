import type { StockSnapshot } from "@jag/inventory";
import { createLogger, type IngredientName, type OrderItem, type PurchaseAttempt, type Recipe } from "@jag/shared";
import { describe, expect, it } from "vitest";
import { prepareItem, type PreparationDeps } from "./prepare-item";

const recipe: Recipe = {
  recipeId: "potato-gratin",
  name: "Papas gratinadas",
  ingredients: [
    { name: "potato", quantity: 3 },
    { name: "cheese", quantity: 2 },
  ],
};

/** Simulación en memoria de los adaptadores, con las mismas reglas que DynamoDB. */
function fakeKitchen(initialStock: StockSnapshot, market: (ingredient: IngredientName) => number) {
  const stock: StockSnapshot = { ...initialStock };
  const consumed = new Set<string>();
  const purchases: PurchaseAttempt[] = [];
  const item: OrderItem = {
    itemId: "item-1",
    orderId: "order-1",
    status: "PENDING",
    attempts: 0,
    createdAt: "t0",
    updatedAt: "t0",
  };

  const deps: PreparationDeps = {
    getItem: async () => ({ ...item }),
    startAttempt: async () => {
      if (item.status === "DELIVERED" || item.status === "FAILED") return undefined;
      item.status = "PREPARING";
      item.attempts += 1;
      return { ...item };
    },
    assignRecipe: async (_item, recipeId) => (item.recipeId ??= recipeId),
    getRecipe: async (id) => (id === recipe.recipeId ? recipe : undefined),
    pickRecipe: () => recipe,
    getStock: async () => ({ ...stock }),
    tryDeliver: async (current, r) => {
      if (consumed.has(current.itemId)) return "ALREADY_DONE";
      if (r.ingredients.some(({ name, quantity }) => (stock[name] ?? 0) < quantity)) return "INSUFFICIENT_STOCK";
      for (const { name, quantity } of r.ingredients) stock[name] = (stock[name] ?? 0) - quantity;
      consumed.add(current.itemId);
      item.status = "DELIVERED";
      return "DELIVERED";
    },
    purchase: async (ingredient, itemId) => {
      const quantitySold = market(ingredient);
      if (quantitySold > 0) stock[ingredient] = (stock[ingredient] ?? 0) + quantitySold;
      const attempt: PurchaseAttempt = {
        purchaseId: `p-${purchases.length}`,
        itemId,
        ingredient,
        quantitySold,
        status: quantitySold > 0 ? "SOLD" : "UNAVAILABLE",
        createdAt: "t1",
      };
      purchases.push(attempt);
      return attempt;
    },
    markWaiting: async () => {
      item.status = "WAITING_INGREDIENTS";
    },
    markFailed: async () => {
      item.status = "FAILED";
    },
    maxAttempts: 3,
    maxPurchasesPerIngredient: 3,
    log: createLogger("test", {}),
  };
  return { deps, stock, item, purchases };
}

describe("prepareItem", () => {
  it("entrega con stock suficiente y descuenta exacto", async () => {
    const kitchen = fakeKitchen({ potato: 5, cheese: 5 }, () => 0);
    expect(await prepareItem("order-1", "item-1", kitchen.deps)).toBe("DELIVERED");
    expect(kitchen.stock).toEqual({ potato: 2, cheese: 3 });
    expect(kitchen.purchases).toHaveLength(0);
  });

  it("un mensaje duplicado no descuenta dos veces", async () => {
    const kitchen = fakeKitchen({ potato: 10, cheese: 10 }, () => 0);
    await prepareItem("order-1", "item-1", kitchen.deps);
    expect(await prepareItem("order-1", "item-1", kitchen.deps)).toBe("ALREADY_DONE");
    expect(kitchen.stock).toEqual({ potato: 7, cheese: 8 });
  });

  it("compra faltantes y entrega cuando el mercado vende", async () => {
    const kitchen = fakeKitchen({ potato: 1, cheese: 2 }, () => 1);
    expect(await prepareItem("order-1", "item-1", kitchen.deps)).toBe("DELIVERED");
    expect(kitchen.purchases.map((p) => p.ingredient)).toEqual(["potato", "potato"]);
    expect(kitchen.stock).toEqual({ potato: 0, cheese: 0 });
  });

  it("queda en espera si el mercado devuelve 0, y falla al agotar intentos", async () => {
    const kitchen = fakeKitchen({ potato: 0, cheese: 0 }, () => 0);
    expect(await prepareItem("order-1", "item-1", kitchen.deps)).toBe("WAITING_INGREDIENTS");
    expect(await prepareItem("order-1", "item-1", kitchen.deps)).toBe("WAITING_INGREDIENTS");
    expect(await prepareItem("order-1", "item-1", kitchen.deps)).toBe("FAILED");
    expect(kitchen.item.status).toBe("FAILED");
    expect(kitchen.stock).toEqual({ potato: 0, cheese: 0 });
  });

  it("mantiene la receta asignada entre reintentos", async () => {
    const kitchen = fakeKitchen({}, () => 0);
    await prepareItem("order-1", "item-1", kitchen.deps);
    kitchen.deps.pickRecipe = () => ({ ...recipe, recipeId: "otra" });
    await prepareItem("order-1", "item-1", kitchen.deps);
    expect(kitchen.item.recipeId).toBe("potato-gratin");
  });
});
