
const axios = require("axios");

async function searchVeganRecipes(query) {
  const apiKey = process.env.SPOONACULAR_API_KEY;

  if (!apiKey) {
    throw new Error("SPOONACULAR_API_KEY is missing");
  }

  const response = await axios.get(
    "https://api.spoonacular.com/recipes/complexSearch",
    {
      params: {
        apiKey,
        query,
        diet: "vegan",
        number: 10,
        addRecipeInformation: true,
        instructionsRequired: false
      },
      timeout: 15000
    }
  );

  console.log(
    `[Spoonacular] "${query}": ${response.data.results.length} recipes found`
  );

  return response.data.results.map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    image: recipe.image,
    summary: recipe.summary,
    sourceUrl: recipe.sourceUrl,
    readyInMinutes: recipe.readyInMinutes,
    ingredients: recipe.extendedIngredients?.map(
      (ingredient) => ingredient.original
    ) || [],
    instructions: recipe.analyzedInstructions?.[0]?.steps?.map(
      (step) => step.step
    ) || []
  }));
}

module.exports = { searchVeganRecipes };
