
require("dotenv").config();

const { searchRecipes } = require("./semanticSearch");

async function main() {
  const query = "I want a hearty meal with chickpeas and vegetables";

  console.log("User query:", query);
  console.log("\nSearching semantically...\n");

  const results = await searchRecipes(query, 3);

  results.forEach((recipe, index) => {
    console.log(`${index + 1}. ${recipe.title}`);
    console.log(
      `Similarity: ${(recipe.similarity * 100).toFixed(2)}%`
    );
    console.log("---");
  });
}

main().catch((error) => {
  console.error("Semantic search failed:", error);
});
