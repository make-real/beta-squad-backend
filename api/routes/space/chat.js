const multipart = require("connect-multiparty");
const spaceChatRouter = require("express").Router({ mergeParams: true });

const { sendMessage, getMessage, memberListToMention } = require("../../controllers/space/chat");

spaceChatRouter.post("/send-messages", multipart(), sendMessage);
spaceChatRouter.get("/get-messages", getMessage);
spaceChatRouter.get("/get-users-to-mention", memberListToMention);

module.exports = spaceChatRouter;
