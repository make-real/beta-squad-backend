const chatRouter = require("express").Router();
const multipart = require("connect-multiparty");

const { sendMessage, getMessages, getChatList } = require("../../controllers/chat");

chatRouter.post("/:workspaceId/send-messages", multipart(), sendMessage);
chatRouter.get("/:workspaceId/get-messages", getMessages);
chatRouter.get("/:workspaceId", getChatList);

module.exports = chatRouter;
