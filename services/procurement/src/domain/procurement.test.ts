import type { PurchaseAttempt } from "@jag/shared";
import { describe, expect, it, vi } from "vitest";
import { buyFromMarket, parseMarketResponse, type MarketResult } from "./market-client";
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

  /** Registra el orden de las llamadas para verificar que el intento se guarda antes de comprar. */
  function recorder(result: MarketResult) {
    const calls: string[] = [];
    const savePurchase = vi.fn(async (purchase: PurchaseAttempt) => {
      calls.push(`save:${purchase.status}`);
    });
    const completePurchase = vi.fn(async (purchase: PurchaseAttempt) => {
      calls.push(`complete:${purchase.status}`);
      return true;
    });
    const buy = vi.fn(async () => {
      calls.push("buy");
      return result;
    });
    return { calls, savePurchase, completePurchase, buy };
  }

  it("registra el intento como REQUESTED antes de llamar al mercado", async () => {
    const deps = recorder({ kind: "sold", quantitySold: 4 });
    await procureIngredient("cheese", "item-1", { ...base, ...deps });
    expect(deps.calls).toEqual(["save:REQUESTED", "buy", "complete:SOLD"]);
    expect(deps.savePurchase).toHaveBeenCalledWith(
      expect.objectContaining({ purchaseId: "p-1", status: "REQUESTED", quantitySold: 0 }),
    );
  });

  it("cierra la compra con la cantidad confirmada (la reposición va en el cierre)", async () => {
    const deps = recorder({ kind: "sold", quantitySold: 4 });
    const purchase = await procureIngredient("cheese", "item-1", { ...base, ...deps });
    expect(purchase).toMatchObject({ purchaseId: "p-1", status: "SOLD", quantitySold: 4, completedAt: base.now() });
    expect(deps.completePurchase).toHaveBeenCalledWith(purchase);
  });

  it("cierra con 0 unidades cuando el mercado no tiene disponibilidad", async () => {
    const deps = recorder({ kind: "unavailable" });
    const purchase = await procureIngredient("cheese", "item-1", { ...base, ...deps });
    expect(purchase).toMatchObject({ status: "UNAVAILABLE", quantitySold: 0 });
    expect(purchase.error).toBeUndefined();
  });

  it("cierra como ERROR con el motivo, sin inventar ventas", async () => {
    const deps = recorder({ kind: "error", error: "Timeout tras 5000 ms" });
    const purchase = await procureIngredient("cheese", "item-1", { ...base, ...deps });
    expect(purchase).toMatchObject({ status: "ERROR", quantitySold: 0, error: "Timeout tras 5000 ms" });
  });

  it("deja el intento en REQUESTED si la compra se interrumpe", async () => {
    const deps = recorder({ kind: "sold", quantitySold: 1 });
    deps.buy.mockRejectedValueOnce(new Error("Lambda interrumpida"));
    await expect(procureIngredient("cheese", "item-1", { ...base, ...deps })).rejects.toThrow("Lambda interrumpida");
    expect(deps.calls).toEqual(["save:REQUESTED"]);
    expect(deps.completePurchase).not.toHaveBeenCalled();
  });
});
