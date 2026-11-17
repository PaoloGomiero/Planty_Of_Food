
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const {
  getConversation,
  saveMessage
} = require("./conversationStore");

const { searchVeganRecipes } = require("./spoonacular");
const { generateReply } = require("./llm");
const { searchRecipes } = require("./semanticSearch");

const {
  getStoredRecipes,
  saveRecipes
} = require("./recipeStore");

const app = express();

app.use(cors());
app.use(express.json());

// Retrieve conversation history
app.get("/api/chat/history/:sessionId", (req, res) => {
  const { sessionId } = req.params;

  res.json({
    history: getConversation(sessionId)
  });
});

// Shared AI assistant handler
async function handleAssistantChat(req, res) {
  try {
    const { message, sessionId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        error: "Message cannot be empty"
      });
    }

    if (!sessionId) {
      return res.status(400).json({
        error: "Session ID is missing"
      });
    }

    console.log("[Chat] User message:", message);

    // Retrieve previous conversation messages
    const history = getConversation(sessionId);

    // Save the new user message
    saveMessage(sessionId, "user", message);

    // Add current message to conversation context
    history.push({
      role: "user",
      content: message
    });

    // Generate response using Groq and RAG function calling
        const result = await generateReply(message, history);
    const reply = result.reply || String(result);

    // Save assistant response
    saveMessage(sessionId, "assistant", reply);

    res.json({
      reply,
      recipes: result.recipes || [],
      history: getConversation(sessionId)
    });


  } catch (error) {
    console.error("[Chat] Error:", error);

    res.status(500).json({
      error: error.message || "Assistant chat failed"
    });
  }
}

// Both chat endpoints use the same AI assistant
app.post("/api/chat", handleAssistantChat);
app.post("/api/assistant-chat", handleAssistantChat);

// Search vegan recipes through Spoonacular and save locally
app.get("/api/recipes", async (req, res) => {
  try {
    const query = (req.query.query || "vegan").trim() || "vegan";

    console.log("Recipe search query:", query);

    const recipes = await searchVeganRecipes(query);
    const storedCount = saveRecipes(recipes);

    res.json({
      count: recipes.length,
      storedCount,
      recipes
    });

  } catch (error) {
    console.error(
      "Spoonacular error:",
      error.response?.data || error.message
    );

    res.status(500).json({
      error: "Unable to retrieve recipes"
    });
  }
});

// Retrieve all locally stored recipes
app.get("/api/recipes/stored", (req, res) => {
  try {
    const recipes = getStoredRecipes();

    res.json({
      count: recipes.length,
      recipes
    });

  } catch (error) {
    console.error("Recipe storage error:", error.message);

    res.status(500).json({
      error: "Unable to retrieve stored recipes"
    });
  }
});

// Test Groq without RAG
app.post("/api/ai-test", async (req, res) => {
  console.log("[AI TEST] Request received");

  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    const result = await generateReply(message);

    res.json({ reply: result.reply || String(result) });


  } catch (error) {
    console.error("[AI TEST] Error:", error);

    res.status(500).json({
      error: error.message || "AI test failed"
    });
  }
});

// Semantic recipe search without generative AI
app.post("/api/semantic-search", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({
        error: "Search query cannot be empty"
      });
    }

    console.log("[Semantic Search] Query:", query);

    const recipes = await searchRecipes(query);

    res.json({
      count: recipes.length,
      recipes
    });

  } catch (error) {
    console.error("[Semantic Search] Error:", error);

    res.status(500).json({
      error: error.message || "Semantic search failed"
    });
  }
});

// Backend health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "success",
    message: "POF Backend is running 🌱"
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`POF server running on port ${PORT}`);
});
