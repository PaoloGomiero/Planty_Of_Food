
require("dotenv").config();

const fs = require("fs");
const path = require("path");

const { generateEmbedding } = require("./embedding");

async function main() {
  const dataFile = path.join(__dirname, "data", "recipes.json");

  const recipes = JSON.parse(
    fs.readFileSync(dataFile, "utf8")
  );

  if (recipes.length === 0) {
    console.log("No recipes found.");
    return;
  }

  for (const recipe of recipes) {
    if (!recipe.searchText) {
      console.log(`Missing searchText: ${recipe.title}`);
      continue;
    }

    if (recipe.embedding) {
      console.log(`Already embedded: ${recipe.title}`);
      continue;
    }

    console.log(`Generating embedding: ${recipe.title}`);

    recipe.embedding = await generateEmbedding(recipe.searchText);

    console.log(
      `Embedding generated: ${recipe.embedding.length} dimensions`
    );
  }

  fs.writeFileSync(
    dataFile,
    JSON.stringify(recipes, null, 2)
  );

  console.log("Embedding generation completed!");
}

main().catch((error) => {
  console.error("Embedding generation failed:", error.message);
});
