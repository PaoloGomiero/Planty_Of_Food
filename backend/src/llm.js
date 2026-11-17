const Groq = require("groq-sdk");
const { searchRecipes } = require("./semanticSearch");

if (!process.env.GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY is missing from environment variables");
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const MODEL = "openai/gpt-oss-120b";
const MAX_TOKENS = 600;

const SYSTEM_PROMPT = `
You are Planty, a friendly and intelligent plant-based recipe assistant.

YOUR ROLE
Help users discover suitable plant-based recipes from the recipe database.

CONVERSATION RULES
- Always communicate in English.
- Be friendly, natural, concise and helpful.
- Understand the user's preferences across the whole conversation.
- Do not search the database for greetings or when the user has given no concrete criterion.
- Ask a follow-up question only when the user has given no concrete criterion at all (no ingredient, dish type, flavour, diet or time limit), considering the whole conversation.
- Ask at most one clarifying question per request. If the user has already answered or restated their constraints, search instead of asking again.

SEARCH RULES
- Use the search_recipes tool to retrieve recipes.
- Whenever the user refines or adds constraints to a previous request (for example "no nuts", "under 30 minutes", "less spicy"), call search_recipes with a query that combines the earlier preferences with the new ones.
- Call search_recipes at most once per user message. After you receive results, write the final answer using them, even if they are not a perfect match. Say clearly which constraints a recipe may not satisfy.
- Never answer from memory about which recipes exist. Titles, times and ingredients must come from a search_recipes result in the current turn.
- Never invent recipes or claim that a recipe exists in the database if it was not returned by the tool.
- Recommend only recipes returned by the tool.
- If no suitable recipes are found, explain this clearly and ask whether the user wants to change the search.
- Do not present unrelated recipes as exact matches.
- Respect dietary preferences and ingredient restrictions expressed by the user.
- The database contains plant-based recipes. Never recommend animal-based recipes. If the user asks for an animal-based dish, explain that Planty only offers plant-based recipes and offer a plant-based alternative search.

RESPONSE RULES
- Present the most relevant recipes first.
- Include the recipe title, a short description, preparation time and source link when available.
- Use only information provided by the retrieved recipes.
- Never invent ingredients, instructions, preparation times or URLs.
- Never mention spices, ingredients or substitutions that do not appear in the ingredients list returned by the tool. If the user asks about an ingredient that is not listed, say you cannot confirm it.
- You have no data about how spicy a recipe is. Do not claim that a recipe is milder or spicier than another; judge spiciness only from ingredients listed (chili, cayenne, hot sauce, jalapeño) and say when you cannot tell.
- Do not give cooking tips, substitutions, quantities or ways to modify a recipe. Describe only what the tool returned. If the user wants a milder or different dish, search again and present the recipes found.
- Do not use tables or pipe characters. Write each recipe as a short bullet list with title, description, preparation time and source link.
- Write every URL as a plain inline URL on its own, without angle brackets and without markdown formatting.
- Write every source link as a full URL starting with https:// so it can be opened directly.

`;

const tools = [
  {
    type: "function",
    function: {
      name: "search_recipes",
      description:
        "Search the local plant-based recipe database. Call this as soon as the user has mentioned at least one concrete criterion: an ingredient, a dish type, a flavour, a diet or a time limit. Constraints from earlier messages in the conversation still count. Also call it when the user refines or adds constraints to a previous request. Do not call it only for greetings or when the user has given no criterion at all.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "A concise search query combining the recipe, ingredients, dietary preferences and other requirements from the whole conversation."
          }
        },
        required: ["query"],
        additionalProperties: false
      }
    }
  }
];

const FALLBACK_REPLY =
  "I'm sorry, I couldn't generate a response. Could you try again?";

function stripHtml(text) {
  return String(text || "").replace(/<[^>]*>/g, "").trim();
}

function buildRecipePayload(recipes) {
  return recipes.slice(0, 4).map(recipe => ({
    id: recipe.id,
    title: recipe.title,
    summary: stripHtml(recipe.summary).slice(0, 150),
    ingredients: (recipe.ingredients || []).slice(0, 20),
    readyInMinutes: recipe.readyInMinutes || null,
    sourceUrl: recipe.sourceUrl || ""
  }));
}

async function runToolCall(toolCall) {
  if (toolCall.function.name !== "search_recipes") {
    return { error: "Unknown tool." };
  }

  let args;
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch (error) {
    return { error: "Invalid search arguments." };
  }

  const query = String(args.query || "").trim();
  if (!query) {
    return { error: "The search query cannot be empty." };
  }

  console.log(`[RAG] Tool called with query: "${query}"`);

  try {
    const recipes = await searchRecipes(query);
    const results = buildRecipePayload(recipes);

    console.log(`[RAG] Retrieved ${results.length} recipes.`);
    console.log(
      `[RAG] Payload to model: ${JSON.stringify(results).length} characters`
    );

    return { count: results.length, recipes: results };
  } catch (error) {
    console.error("[RAG] Search error:", error.message);
    return { error: "The recipe database search failed." };
  }
}

async function generateReply(message, history = []) {
  console.log("[Groq] Starting conversation...");

    let retrievedRecipes = [];


  const conversationMessages = history
    .filter(
      item =>
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string"
    )
    .slice(-20)
    .map(item => ({
      role: item.role,
      content: item.content
    }));

  // The current message is already in history when called by server.js.
  if (
    conversationMessages.length === 0 ||
    conversationMessages[conversationMessages.length - 1].role !== "user" ||
    conversationMessages[conversationMessages.length - 1].content !== message
  ) {
    conversationMessages.push({
      role: "user",
      content: message
    });
  }

  // If the last assistant message presented recipes (it contains a link),
  // the next user message is a follow-up and must trigger a new search.
  const lastAssistant = [...conversationMessages]
    .reverse()
    .find(item => item.role === "assistant");
  const forceSearch =
    !!lastAssistant && /https?:\/\//.test(lastAssistant.content);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...conversationMessages
  ];

  // First call: the model decides whether to use the RAG tool.
  const firstResponse = await groq.chat.completions.create({
    model: MODEL,
    messages,
    tools,
    tool_choice: forceSearch ? "required" : "auto",
    parallel_tool_calls: false,
    temperature: 0.3,
    max_tokens: MAX_TOKENS
  });

  const assistantMessage = firstResponse.choices[0].message;
  const toolCalls = assistantMessage.tool_calls || [];

    if (toolCalls.length === 0) {
    console.log("[Groq] Responded without calling RAG.");
    return {
      reply: assistantMessage.content || FALLBACK_REPLY,
      recipes: []
    };
  }


  messages.push({
    role: "assistant",
    content: assistantMessage.content || null,
    tool_calls: toolCalls
  });

  for (const toolCall of toolCalls) {
    const result = await runToolCall(toolCall);
    if (Array.isArray(result.recipes)) {
      retrievedRecipes = result.recipes;
    }

    messages.push({
      role: "tool",
      tool_call_id: toolCall.id,
      content: JSON.stringify(result)
    });
  }

 
    // Second call: the model writes the answer from the retrieved recipes.
  // "tools" must be present when tool_choice is "none".
  let reply;
  try {
    const finalResponse = await groq.chat.completions.create({
      model: MODEL,
      messages,
      tools,
      tool_choice: "none",
      temperature: 0.3,
      max_tokens: MAX_TOKENS
    });

    console.log("[Groq] Final answer generated from RAG results.");
    reply = finalResponse.choices[0].message.content || FALLBACK_REPLY;
  } catch (error) {
    console.error("[Groq] Final response error:", error.message);
    reply = "I found some recipes but couldn't write up the answer. Could you repeat your request?";
  }

  return {
    reply,
    recipes: retrievedRecipes
  };
}


module.exports = { generateReply };
