import { createRouter, json } from "@jag/shared";
import { listRecipes } from "./repository";

export const handler = createRouter({
  "GET /recipes": async () => json(200, { recipes: await listRecipes() }),
});
