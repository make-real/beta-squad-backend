const chatRouter = require("express").Router({ mergeParams: true });
const multipart = require("connect-multiparty");

const { sendMessage, getMessages, getChatList } = require("../../controllers/chat");

chatRouter.post("/:receiver", multipart(), sendMessage);
chatRouter.get("/:receiver", getMessages);
chatRouter.get("/", getChatList);

module.exports = chatRouter;
