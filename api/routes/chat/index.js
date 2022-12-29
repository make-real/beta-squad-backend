const chatRouter = require("express").Router({ mergeParams: true });
const multipart = require("connect-multiparty");

const { sendMessage, getMessages, getChatList, messageDelete } = require("../../controllers/chat");

chatRouter.post("/:receiver", multipart(), sendMessage);
chatRouter.get("/:receiver", getMessages);
chatRouter.delete("/:receiver/message/:messageId", messageDelete);
chatRouter.get("/", getChatList);

module.exports = chatRouter;
