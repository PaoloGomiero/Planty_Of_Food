
const fs = require("fs");
const path = require("path");

const dataDirectory = path.join(__dirname, "data");
const dataFile = path.join(dataDirectory, "recipes.json");

if (!fs.existsSync(dataDirectory)) {
  fs.mkdirSync(dataDirectory, { recursive: true });
}

if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, JSON.stringify([], null, 2));
}

function getStoredRecipes() {
  return JSON.parse(fs.readFileSync(dataFile, "utf8"));
}

// Remove HTML tags from Spoonacular descriptions
function cleanText(text = "") {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// Build a searchable text document for each recipe
function buildRecipeText(recipe) {
  const summary = cleanText(recipe.summary || "");
  const ingredients = (recipe.ingredients || []).join(", ");
  const instructions = (recipe.instructions || []).join(" ");

  return `
Recipe: ${recipe.title}
Description: ${summary}
Ingredients: ${ingredients}
Instructions: ${instructions}
Preparation time: ${recipe.readyInMinutes || "Unknown"} minutes
`.trim();
}

function saveRecipes(newRecipes) {
  const existingRecipes = getStoredRecipes();

  const recipesMap = new Map(
    existingRecipes.map((recipe) => [recipe.id, recipe])
  );

  newRecipes.forEach((recipe) => {
    const updatedRecipe = {
      ...recipesMap.get(recipe.id),
      ...recipe,
      searchText: buildRecipeText(recipe),
      updatedAt: new Date().toISOString()
    };

    recipesMap.set(recipe.id, updatedRecipe);
  });

  const updatedRecipes = Array.from(recipesMap.values());

  fs.writeFileSync(
    dataFile,
    JSON.stringify(updatedRecipes, null, 2)
  );

  console.log(
    `[Recipe Store] ${newRecipes.length} recipes processed. Total stored: ${updatedRecipes.length}`
  );

  return updatedRecipes.length;
}

module.exports = {
  getStoredRecipes,
  saveRecipes
};
