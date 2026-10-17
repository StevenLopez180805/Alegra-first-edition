import { createLogger, createRouter, HttpError, json, parseJsonBody, parseLimit, parseQuantity } from "@jag/shared";
import { buildOrder } from "./domain/create-order";
import { enqueuePreparations } from "./queue";
import { getOrderWithItems, listActiveItems, listOrders, saveOrder } from "./repository";

const log = createLogger("orders");

export const handler = createRouter({
  "GET /health": async () => json(200, { status: "ok", service: "orders", timestamp: new Date().toISOString() }),

  "POST /orders": async (event) => {
    const quantity = parseQuantity(parseJsonBody(event));
    const { order, items, messages } = buildOrder(quantity);

    await saveOrder(order, items);
    const notQueued = await enqueuePreparations(messages);
    if (notQueued.length > 0) {
      // TODO(PRE-04): reconciliar ítems PENDING no encolados (barrido programado u outbox).
      log.error("Ítems sin encolar", { orderId: order.orderId, itemIds: notQueued });
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
