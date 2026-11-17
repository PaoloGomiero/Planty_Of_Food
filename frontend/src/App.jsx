import { useState, useEffect, useRef } from "react";
import "./App.css";

const API_URL =
  import.meta.env.VITE_API_URL || "[localhost](http://localhost:3000)".replace("http://", "http" + "://");


function MessageText({ text }) {
  const urlPattern = /(https?:\/\/[^\s<>()]+)/g;

  return (
    <>
      {String(text).split("\n").map((line, lineIndex) => (
        <span key={lineIndex}>
          {line.split(urlPattern).map((part, partIndex) =>
            part.startsWith("http") ? (
              <a key={partIndex} href={part} target="_blank" rel="noreferrer">
                {part}
              </a>
            ) : (
              <span key={partIndex}>{part}</span>
            )
          )}
          <br />
        </span>
      ))}
    </>
  );
}


function App() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState([]);

  const [sessionId] = useState(() => {
    let id = localStorage.getItem("pof-session-id");

    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("pof-session-id", id);
    }

    return id;
  });

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I'm Planty. Your personal plant-based recipe assistant. What would you like to cook today?"
    }
  ]);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, recipes]);

  async function handleSend(event) {
    event.preventDefault();

    if (!message.trim() || loading) return;

    const userMessage = message.trim();

    setMessages((previous) => [
      ...previous,
      { role: "user", content: userMessage }
    ]);

    setMessage("");
    setLoading(true);
    setRecipes([]);

    try {
      const response = await fetch(API_URL + "/api/assistant-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: userMessage,
          sessionId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Assistant chat failed");
      }

      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: data.reply }
      ]);

      setRecipes(data.recipes || []);
    } catch (error) {
      console.error("Assistant chat error:", error);

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            "Sorry, I couldn't answer right now. Please try again."
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">Planty of Food</div>
        <span className="subtitle">
          Your plant-based cooking assistant
        </span>
      </header>

      <main className="chat-container">
        <section className="messages">
          {messages.map((item, index) => (
            <div
              key={index}
              className={`message ${item.role}`}
            >
              <MessageText text={item.content} />
            </div>
          ))}

          {loading && (
            <div className="message assistant">
              Planty is thinking...
            </div>
          )}

          {recipes.length > 0 && (
            <section className="recipes">
              {recipes.map((recipe) => (
                <article className="recipe-card" key={recipe.id}>
                  {recipe.image && (
                    <img src={recipe.image} alt={recipe.title} />
                  )}

                  <div className="recipe-content">
                    <h2>{recipe.title}</h2>

                    <p>
                      {recipe.readyInMinutes || "?"} minutes
                    </p>

                    {recipe.summary && <p>{recipe.summary}</p>}

                    {recipe.sourceUrl && (
                      <a
                        href={recipe.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View full recipe
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </section>
          )}

          <div ref={messagesEndRef} />
        </section>

        <form className="input-area" onSubmit={handleSend}>
          <input
            type="text"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="e.g. I'd like a spicy chickpea dinner, no nuts"
            disabled={loading}
          />

          <button type="submit" disabled={loading}>
            {loading ? "Thinking..." : "Send"}
          </button>
        </form>
      </main>

      <footer>
        Planty of Food · Discover the joy of plant-based cooking
      </footer>
    </div>
  );
}

export default App;
