const { saveAiMessage, getAiChatHistory } = require("../../controllers/space/ai-chat");

const aiChatRouter = require("express").Router({ mergeParams: true });

aiChatRouter.post("/save-message", saveAiMessage);
aiChatRouter.get("/get-messages", getAiChatHistory);

module.exports = aiChatRouter;
