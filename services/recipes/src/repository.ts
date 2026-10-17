import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getDocumentClient, keys, stripKeys, tableName } from "@jag/persistence";
import type { Recipe } from "@jag/shared";

export async function listRecipes(): Promise<Recipe[]> {
  const result = await getDocumentClient().send(
    new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": keys.recipe("").PK },
    }),
  );
  return (result.Items ?? []).map((item) => stripKeys<Recipe>(item));
}

export async function getRecipe(recipeId: string): Promise<Recipe | undefined> {
  const result = await getDocumentClient().send(
    new GetCommand({ TableName: tableName(), Key: keys.recipe(recipeId) }),
  );
  return result.Item ? stripKeys<Recipe>(result.Item) : undefined;
}
