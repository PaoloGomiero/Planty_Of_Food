
const fs = require("fs");
const path = require("path");

const dataDirectory = path.join(__dirname, "data");
const dataFile = path.join(dataDirectory, "conversations.json");

if (!fs.existsSync(dataDirectory)) {
  fs.mkdirSync(dataDirectory, { recursive: true });
}

if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, JSON.stringify({}, null, 2));
}

function readConversations() {
  return JSON.parse(fs.readFileSync(dataFile, "utf8"));
}

function getConversation(sessionId) {
  const conversations = readConversations();
  return conversations[sessionId] || [];
}

function saveMessage(sessionId, role, content) {
  const conversations = readConversations();

  if (!conversations[sessionId]) {
    conversations[sessionId] = [];
  }

  conversations[sessionId].push({
    role,
    content,
    timestamp: new Date().toISOString()
  });

  fs.writeFileSync(
    dataFile,
    JSON.stringify(conversations, null, 2)
  );
}

module.exports = {
  getConversation,
  saveMessage
};
