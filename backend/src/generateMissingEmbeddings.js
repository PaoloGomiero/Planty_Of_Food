
require("dotenv").config();

const fs = require("fs");
const path = require("path");

const { getStoredRecipes } = require("./recipeStore");
const { generateEmbedding } = require("./embedding");

async function main() {
  const dataFile = path.join(__dirname, "data", "recipes.json");
  const recipes = getStoredRecipes();

  const pending = recipes.filter(
    (recipe) =>
      recipe.searchText &&
      !Array.isArray(recipe.embedding)
  );

  console.log(`Total recipes: ${recipes.length}`);
  console.log(`Missing embeddings: ${pending.length}`);

  let completed = 0;

  for (const recipe of pending) {
    try {
      console.log(`Generating: ${recipe.title}`);

      recipe.embedding = await generateEmbedding(
        recipe.searchText,
        "RETRIEVAL_DOCUMENT"
      );

      fs.writeFileSync(
        dataFile,
        JSON.stringify(recipes, null, 2)
      );

      completed++;
      console.log(`Completed: ${completed}/${pending.length}`);
    } catch (error) {
      console.error(`Failed: ${recipe.title}`);
      console.error(error.message);
      break;
    }
  }

  console.log("\nEmbedding process finished.");
  console.log(`Successfully generated: ${completed}`);
  console.log(
    `Recipes with embeddings: ${recipes.filter(r => Array.isArray(r.embedding)).length}`
  );
}

main().catch(console.error);
