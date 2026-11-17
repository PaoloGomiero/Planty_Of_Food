const { getStoredRecipes } = require("./recipeStore");
const { generateEmbedding } = require("./embedding");

const MIN_SCORE = 0.62;
const SCORE_GAP = 0.10;

function cosineSimilarity(vectorA, vectorB) {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    magnitudeA += vectorA[i] ** 2;
    magnitudeB += vectorB[i] ** 2;
  }

  if (magnitudeA === 0 || magnitudeB === 0) return 0;

  return dotProduct / (
    Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB)
  );
}

const stopWords = new Set([
  "i", "want", "a", "an", "the", "with", "some",
  "please", "give", "me", "find", "recipe", "recipes",
  "meal", "dish", "make", "for", "and", "of", "to",
  "is", "are", "vegan", "plant", "based", "something",
  "that", "can", "you", "recommend", "what", "how",
  "about", "looking", "like", "need", "would"
]);

function normalizeToken(token) {
  let word = token.toLowerCase();

  if (word.length > 4 && word.endsWith("ies")) {
    return word.slice(0, -3) + "y";
  }

  if (word.length > 4 && word.endsWith("oes")) {
    return word.slice(0, -2);
  }

  if (word.length > 3 && word.endsWith("s")) {
    return word.slice(0, -1);
  }

  return word;
}

function getQueryTerms(query) {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .map(normalizeToken);
}

function getLexicalScore(queryTerms, recipe) {
  if (queryTerms.length === 0) return 0;

  const recipeText = [
    recipe.title || "",
    ...(recipe.ingredients || [])
  ].join(" ");

  const recipeTerms = new Set(
    recipeText
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .map(normalizeToken)
  );

  const matchedTerms = queryTerms.filter(term =>
    recipeTerms.has(term)
  );

  return matchedTerms.length / queryTerms.length;
}

async function searchRecipes(query) {
  const recipes = getStoredRecipes();

  const queryTerms = getQueryTerms(query);

  // A query made only of stop words cannot produce a useful search.
  if (queryTerms.length === 0) {
    console.log(
      `[Semantic Search] "${query}" | No usable query terms.`
    );

    return [];
  }

  const queryEmbedding = await generateEmbedding(
    query,
    "RETRIEVAL_QUERY"
  );

  const rankedRecipes = recipes
    .filter(recipe =>
      Array.isArray(recipe.embedding) &&
      recipe.embedding.length === queryEmbedding.length
    )
    .map(recipe => {
      const similarity = cosineSimilarity(
        queryEmbedding,
        recipe.embedding
      );

      const lexicalScore = getLexicalScore(
        queryTerms,
        recipe
      );

      const score = similarity + lexicalScore * 0.2;

      return {
        ...recipe,
        similarity,
        lexicalScore,
        score
      };
    })
    .sort((a, b) => b.score - a.score);

  if (rankedRecipes.length === 0) return [];

  const bestScore = rankedRecipes[0].score;

  // No recipe is relevant enough: return nothing rather than noise.
  if (bestScore < MIN_SCORE) {
    console.log(
      `[Semantic Search] "${query}" | Best score: ${bestScore.toFixed(3)} | Below minimum: no results`
    );

    return [];
  }

  const threshold = Math.max(
    MIN_SCORE,
    bestScore - SCORE_GAP
  );

  const results = rankedRecipes.filter(
    recipe => recipe.score >= threshold
  );

  console.log(
    `[Semantic Search] "${query}" | Best score: ${bestScore.toFixed(3)} | Threshold: ${threshold.toFixed(3)} | Results: ${results.length}`
  );

  return results;
}

module.exports = { searchRecipes };
