const chatRouter = require("express").Router();
const multipart = require("connect-multiparty");

const { sendMessage } = require("../../controllers/chat");

chatRouter.post("/send-messages", multipart(), sendMessage);

module.exports = chatRouter;
