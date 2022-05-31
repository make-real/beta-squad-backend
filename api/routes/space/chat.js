const multipart = require("connect-multiparty");
const spaceChatRouter = require("express").Router({ mergeParams: true });

const { sendMessage } = require("../../controllers/space/chat");

spaceChatRouter.post("/send-messages", multipart(), sendMessage);

module.exports = spaceChatRouter;
