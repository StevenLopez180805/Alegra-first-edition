import { createRouter, json, parseLimit } from "@jag/shared";
import { listPurchases } from "./repository";

export const handler = createRouter({
  "GET /purchases": async (event) => json(200, { purchases: await listPurchases(parseLimit(event)) }),
});
