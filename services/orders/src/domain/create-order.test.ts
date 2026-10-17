import { describe, expect, it } from "vitest";
import { buildOrder } from "./create-order";

describe("buildOrder", () => {
  it("crea exactamente `quantity` ítems PENDING con un mensaje cada uno", () => {
    const { order, items, messages } = buildOrder(10);
    expect(order.quantity).toBe(10);
    expect(items).toHaveLength(10);
    expect(items.every((item) => item.status === "PENDING" && item.orderId === order.orderId)).toBe(true);
    expect(new Set(items.map((item) => item.itemId)).size).toBe(10);
    expect(messages.map((m) => m.itemId)).toEqual(items.map((item) => item.itemId));
  });

  it("no asigna receta al crear (se asigna y persiste en preparación)", () => {
    const { items } = buildOrder(3);
    expect(items.every((item) => item.recipeId === undefined)).toBe(true);
  });
});
