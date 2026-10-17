import { createRouter, json } from "@jag/shared";
import { getStock } from "./repository";

export const handler = createRouter({
  "GET /inventory": async () => json(200, { ingredients: await getStock() }),
});
