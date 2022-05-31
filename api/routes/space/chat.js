const multipart = require("connect-multiparty");
const spaceChatRouter = require("express").Router({ mergeParams: true });

const { sendMessage, getMessage } = require("../../controllers/space/chat");

spaceChatRouter.post("/send-messages", multipart(), sendMessage);
spaceChatRouter.get("/get-messages", getMessage);

module.exports = spaceChatRouter;
