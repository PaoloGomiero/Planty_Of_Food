
const { GoogleGenAI } = require("@google/genai");

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing");
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

async function generateEmbedding(
  text,
  taskType = "RETRIEVAL_DOCUMENT"
) {
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: {
      taskType,
      outputDimensionality: 768
    }
  });

  return response.embeddings[0].values;
}

module.exports = { generateEmbedding };
