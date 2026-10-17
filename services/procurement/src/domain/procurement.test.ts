import { describe, expect, it, vi } from "vitest";
import { buyFromMarket, parseMarketResponse } from "./market-client";
import { procureIngredient } from "./procure";

describe("parseMarketResponse", () => {
  it("interpreta ventas, 0 y respuestas inválidas", () => {
    expect(parseMarketResponse({ quantitySold: 3 })).toEqual({ kind: "sold", quantitySold: 3 });
    expect(parseMarketResponse({ quantitySold: 0 })).toEqual({ kind: "unavailable" });
    for (const body of [{ quantitySold: -1 }, { quantitySold: 1.5 }, { quantitySold: "2" }, {}, null]) {
      expect(parseMarketResponse(body).kind).toBe("error");
    }
  });
});

describe("buyFromMarket", () => {
  it("envía el ingrediente como parámetro", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ quantitySold: 2 }));
    const result = await buyFromMarket("tomato", { fetchImpl, baseUrl: "https://market.test/buy" });
    expect(result).toEqual({ kind: "sold", quantitySold: 2 });
    expect(String((fetchImpl.mock.calls[0] as unknown[])[0])).toBe("https://market.test/buy?ingredient=tomato");
  });

  it("trata un HTTP no exitoso como error", async () => {
    const fetchImpl = vi.fn(async () => new Response("boom", { status: 503 }));
    expect((await buyFromMarket("rice", { fetchImpl })).kind).toBe("error");
  });

  it("devuelve error ante timeout sin inventar ventas", async () => {
    const fetchImpl = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const result = await buyFromMarket("onion", { fetchImpl, timeoutMs: 10 });
    expect(result).toMatchObject({ kind: "error" });
  });
});

describe("procureIngredient", () => {
  const base = { now: () => "2026-10-18T00:00:00.000Z", newId: () => "p-1" };

  it("repone solo la cantidad confirmada", async () => {
    const restock = vi.fn(async () => true);
    const savePurchase = vi.fn(async () => {});
    const purchase = await procureIngredient("cheese", "item-1", {
      ...base,
      buy: async () => ({ kind: "sold", quantitySold: 4 }),
      savePurchase,
      restock,
    });
    expect(purchase.status).toBe("SOLD");
    expect(savePurchase).toHaveBeenCalledOnce();
    expect(restock).toHaveBeenCalledWith("cheese", 4, "p-1");
  });

  it("no repone cuando el mercado devuelve 0", async () => {
    const restock = vi.fn(async () => true);
    const purchase = await procureIngredient("cheese", "item-1", {
      ...base,
      buy: async () => ({ kind: "unavailable" }),
      savePurchase: async () => {},
      restock,
    });
    expect(purchase).toMatchObject({ status: "UNAVAILABLE", quantitySold: 0 });
    expect(restock).not.toHaveBeenCalled();
  });
});
