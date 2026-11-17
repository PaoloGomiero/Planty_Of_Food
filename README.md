# POF - Planty of Food

A conversational AI assistant that helps users find plant-based recipes
through natural conversation.

Planty understands the user's preferences, decides on its own when it has
enough information to search, and answers using recipes retrieved from a
local database. It never invents recipes.

## Overview

This project was built as the final assignment of an AI and AI Agents for
Business course. The goal was to integrate a large language model with a
retrieval-augmented generation (RAG) pipeline and expose retrieval to the
model as a callable tool, so that the database is queried only when needed.

## Architecture

React frontend | v Node.js + Express backend 
 Groq (openai/gpt-oss-120b) for conversation | and function calling | 
 
 RAG pipeline - Google Gemini embeddings (gemini-embedding-001, 768 dims) - cosine similarity + lexical scoring - dynamic threshold | 
 
 Local recipe database (JSON, 92 recipes) populated via the Spoonacular API


The LLM decides when to call `search_recipes`. Greetings and vague requests
do not trigger a search: the assistant asks a clarifying question first, and
only when the request contains a concrete criterion does it query the
retrieval layer.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Conversational LLM | Groq - `openai/gpt-oss-120b` |
| Embeddings | Google Gemini - `gemini-embedding-001` |
| Recipe source | Spoonacular API |
| Database | Local JSON file |
| Retrieval | Embeddings + cosine similarity + lexical scoring |
| Memory | Local JSON file, per session |


## API endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/assistant-chat` | Main conversational endpoint (LLM + RAG + memory) |
| POST | `/api/chat` | Same handler as above |
| GET | `/api/chat/history/:sessionId` | Conversation history for a session |
| GET | `/api/recipes/stored` | All locally stored recipes |
| POST | `/api/semantic-search` | Raw semantic search, without the LLM |
| POST | `/api/ai-test` | LLM test without tools |
| GET | `/api/health` | Health check |

## Setup

### Requirements

- Node.js 18 or later
- API keys for Groq, Google Gemini and Spoonacular

### Backend

```bash
cd backend
npm install

Create a .env file in backend/ with GROQ_API_KEY, GEMINI_API_KEY,SPOONACULAR_API_KEY, PORT=3000
Then start the server with node src/server.js

The frontend runs on [localhost](http://localhost:5173) and calls the backend on [localhost](http://localhost:3000).

Manual scripts
These scripts are run by hand and are not part of the normal startup. The first two consume Spoonacular API quota, so run them only when you actually need new recipes.

Script	Purpose
node src/populateRecipes.js	Fetches vegan recipes from Spoonacular and adds them to the local database
node src/generateMissingEmbeddings.js	Generates embeddings for recipes that do not have one yet
node src/testSemanticSearch.js	Command-line test for the retrieval layer
How the RAG works
The user writes a message.
The LLM decides whether the request contains enough information.
If it does, the model calls the search_recipes tool with a query.
The backend generates an embedding for the query with Gemini and compares it to the stored recipe embeddings using cosine similarity, combined with a lexical score on title and ingredients.
A dynamic threshold keeps the results above a minimum relevance level. If nothing is relevant enough, the search returns zero recipes instead of noise.
The retrieved recipes are sent back to the model, which writes the final answer using only that data.
Conversation memory
Messages are stored per session in backend/src/data/conversations.json. The frontend generates a session id once and keeps it in localStorage, so the assistant remembers preferences across the conversation.

Notes and limitations
The recipe database and the conversation memory are local JSON files. On hosting platforms with an ephemeral filesystem, these may be reset on restart or redeploy.
The recipe descriptions come from Spoonacular and are reduced before being sent to the model, to stay within the free tier token limits.
The assistant asks a clarifying question when the request is too vague. This is intentional: it avoids useless database queries and answers that do not match the user's actual need.
