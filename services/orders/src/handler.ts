import { createLogger, createRouter, HttpError, json, parseJsonBody, parseLimit, parseQuantity } from "@jag/shared";
import { buildOrder } from "./domain/create-order";
import { enqueuePreparations } from "./queue";
import { clearOutbox, getOrderWithItems, listActiveItems, listOrders, saveOrder } from "./repository";

const log = createLogger("orders");

export const handler = createRouter({
  "GET /health": async () => json(200, { status: "ok", service: "orders", timestamp: new Date().toISOString() }), // Esto es basicamente para probar que el servicio si este arriba

  "POST /orders": async (event) => {
    const quantity = parseQuantity(parseJsonBody(event));
    const { order, items, messages } = buildOrder(quantity);

    await saveOrder(order, items);
    const notQueued = await enqueuePreparations(messages);
    if (notQueued.length > 0) {
      // El outbox se conserva: el barrido de reconciliación reencolará los platos que sigan PENDING.
      log.warn("Ítems sin encolar; se reintentarán en la reconciliación", { orderId: order.orderId, itemIds: notQueued });
    } else {
      await clearOutbox({ orderId: order.orderId, createdAt: order.createdAt });
    }
    log.info("Pedido creado", { orderId: order.orderId, quantity });

    return json(202, { orderId: order.orderId, quantity, status: "PENDING" });
  },

  "GET /orders": async (event) => json(200, { orders: await listOrders(parseLimit(event)) }),

  "GET /orders/{orderId}": async (event) => {
    const orderId = event.pathParameters?.orderId;
    if (!orderId) throw new HttpError(400, "orderId requerido");
    const order = await getOrderWithItems(orderId);
    if (!order) throw new HttpError(404, "Pedido no encontrado");
    return json(200, order);
  },

  "GET /preparations": async (event) => json(200, { items: await listActiveItems(parseLimit(event, 100, 500)) }),
});
