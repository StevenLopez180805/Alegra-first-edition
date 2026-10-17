/**
 * Seed idempotente: 10 ingredientes con stock inicial y las 6 recetas.
 * Uso: TABLE_NAME=<tabla> AWS_REGION=<región> pnpm seed
 * No sobrescribe registros existentes (attribute_not_exists), así que es seguro repetirlo.
 */
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { getDocumentClient, keys, nowIso, tableName } from "@jag/persistence";
import { RECIPES } from "@jag/recipes";
import { INGREDIENTS, INITIAL_STOCK } from "@jag/shared";

async function putIfAbsent(item: Record<string, unknown>): Promise<boolean> {
  try {
    await getDocumentClient().send(
      new PutCommand({ TableName: tableName(), Item: item, ConditionExpression: "attribute_not_exists(PK)" }),
    );
    return true;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) return false;
    throw error;
  }
}

async function main() {
  const now = nowIso();
  let created = 0;

  for (const name of INGREDIENTS) {
    if (await putIfAbsent({ ...keys.ingredient(name), name, stock: INITIAL_STOCK, updatedAt: now })) created++;
  }
  for (const recipe of RECIPES) {
    if (await putIfAbsent({ ...keys.recipe(recipe.recipeId), ...recipe })) created++;
  }

  const total = INGREDIENTS.length + RECIPES.length;
  console.log(`Seed en ${tableName()}: ${created} registros creados, ${total - created} ya existían.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
