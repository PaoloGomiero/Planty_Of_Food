
require("dotenv").config();

const { searchVeganRecipes } = require("./spoonacular");
const { saveRecipes } = require("./recipeStore");
const { generateEmbedding } = require("./embedding");
const { getStoredRecipes } = require("./recipeStore");

const queries = [
  "tomato",
  "potato",
  "pasta",
  "lentils",
  "tofu",
  "mushrooms",
  "broccoli",
  "rice",
  "eggplant",
  "vegetable curry"
];

async function main() {
  const existingRecipes = getStoredRecipes();
  const existingIds = new Set(existingRecipes.map((r) => r.id));

  let added = 0;

  for (const query of queries) {
    console.log(`\nSearching recipes for: ${query}`);

    try {
      const recipes = await searchVeganRecipes(query);

      const newRecipes = recipes.filter(
        (recipe) => !existingIds.has(recipe.id)
      );

      if (newRecipes.length === 0) {
        console.log("No new recipes to add.");
        continue;
      }

      saveRecipes(newRecipes);

      for (const recipe of newRecipes) {
        console.log(`Generating embedding: ${recipe.title}`);

        recipe.embedding = await generateEmbedding(
          recipe.searchText,
          "RETRIEVAL_DOCUMENT"
        );

        existingIds.add(recipe.id);
        added++;
      }

      console.log(`${newRecipes.length} new recipes processed.`);
    } catch (error) {
      console.error(
        `Error searching "${query}":`,
        error.message
      );
    }
  }

  console.log(`\nCompleted. New recipes added: ${added}`);
  console.log(`Total recipes in database: ${getStoredRecipes().length}`);
}

main().catch(console.error);
