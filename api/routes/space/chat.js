const multipart = require("connect-multiparty");
const spaceChatRouter = require("express").Router({ mergeParams: true });

const { sendMessage, getMessage, memberListToMention, messageEdit, messageDelete, messageReaction } = require("../../controllers/space/chat");

spaceChatRouter.post("/send-messages", multipart(), sendMessage);
spaceChatRouter.get("/get-messages", getMessage);
spaceChatRouter.get("/get-users-to-mention", memberListToMention);
spaceChatRouter.patch("/:messageId", messageEdit);
spaceChatRouter.delete("/:messageId", messageDelete);
spaceChatRouter.put("/:messageId", messageReaction);

module.exports = spaceChatRouter;
