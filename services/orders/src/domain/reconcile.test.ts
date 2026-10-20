import { createLogger, type OrderItem, type PrepareOrderItemMessage } from "@jag/shared";
import { describe, expect, it, vi } from "vitest";
import { reconcilePendingOrders, type OutboxRef, type ReconcileDeps } from "./reconcile";

const NOW = new Date("2026-10-19T12:10:00.000Z");

const pendingItem = (orderId: string, itemId: string): OrderItem => ({
  itemId,
  orderId,
  status: "PENDING",
  attempts: 0,
  createdAt: "2026-10-19T12:00:00.000Z",
  updatedAt: "2026-10-19T12:00:00.000Z",
});

function fakeDeps(outbox: OutboxRef[], pendingByOrder: Record<string, OrderItem[]>, failing: string[] = []) {
  const enqueued: PrepareOrderItemMessage[] = [];
  const cleared: string[] = [];
  const deps: ReconcileDeps = {
    listStaleOutbox: vi.fn(async (olderThan: string) => outbox.filter((entry) => entry.createdAt < olderThan)),
    listPendingItems: async (orderId) => pendingByOrder[orderId] ?? [],
    enqueue: async (messages) => {
      enqueued.push(...messages.filter((m) => !failing.includes(m.itemId)));
      return messages.filter((m) => failing.includes(m.itemId)).map((m) => m.itemId);
    },
    clearOutbox: async (entry) => {
      cleared.push(entry.orderId);
    },
    log: createLogger("test"),
    now: () => NOW,
  };
  return { deps, enqueued, cleared };
}

describe("reconcilePendingOrders", () => {
  it("reencola los platos PENDING de pedidos vencidos y limpia su outbox", async () => {
    const { deps, enqueued, cleared } = fakeDeps([{ orderId: "o1", createdAt: "2026-10-19T12:00:00.000Z" }], {
      o1: [pendingItem("o1", "a"), pendingItem("o1", "b")],
    });
    const summary = await reconcilePendingOrders(deps);
    expect(enqueued.map((m) => m.itemId)).toEqual(["a", "b"]);
    expect(cleared).toEqual(["o1"]);
    expect(summary).toEqual({ ordersChecked: 1, itemsRequeued: 2, ordersCleared: 1, ordersPending: 0 });
  });

  it("respeta el margen de gracia para no competir con un POST en curso", async () => {
    const { deps } = fakeDeps([{ orderId: "o1", createdAt: "2026-10-19T12:09:30.000Z" }], { o1: [pendingItem("o1", "a")] });
    const summary = await reconcilePendingOrders(deps, { graceSeconds: 120, batchLimit: 25 });
    expect(deps.listStaleOutbox).toHaveBeenCalledWith("2026-10-19T12:08:00.000Z", 25);
    expect(summary.ordersChecked).toBe(0);
  });

  it("limpia el outbox sin encolar si ya no quedan platos PENDING", async () => {
    const { deps, enqueued, cleared } = fakeDeps([{ orderId: "o1", createdAt: "2026-10-19T12:00:00.000Z" }], { o1: [] });
    await reconcilePendingOrders(deps);
    expect(enqueued).toEqual([]);
    expect(cleared).toEqual(["o1"]);
  });

  it("conserva el outbox si algún plato no se pudo encolar", async () => {
    const { deps, cleared } = fakeDeps(
      [{ orderId: "o1", createdAt: "2026-10-19T12:00:00.000Z" }],
      { o1: [pendingItem("o1", "a"), pendingItem("o1", "b")] },
      ["b"],
    );
    const summary = await reconcilePendingOrders(deps);
    expect(cleared).toEqual([]);
    expect(summary).toMatchObject({ itemsRequeued: 1, ordersPending: 1, ordersCleared: 0 });
  });

  it("un error en un pedido no detiene el barrido de los demás", async () => {
    const { deps, cleared } = fakeDeps(
      [
        { orderId: "roto", createdAt: "2026-10-19T12:00:00.000Z" },
        { orderId: "o2", createdAt: "2026-10-19T12:01:00.000Z" },
      ],
      { o2: [pendingItem("o2", "x")] },
    );
    const original = deps.listPendingItems;
    deps.listPendingItems = async (orderId) => {
      if (orderId === "roto") throw new Error("DynamoDB no disponible");
      return original(orderId);
    };
    const summary = await reconcilePendingOrders(deps);
    expect(cleared).toEqual(["o2"]);
    expect(summary).toMatchObject({ ordersChecked: 2, ordersCleared: 1, ordersPending: 1 });
  });
});
