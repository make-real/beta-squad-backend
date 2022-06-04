const spaceRouter = require("express").Router();

const { createSpace, getSpaces, updateSpace, addMembers, removeMembers, getMembers } = require("../../controllers/space");
const spaceChatRoutes = require("./chat");
const boardRoutes = require("./board");
const rowRoutes = require("./row");

spaceRouter.post("/", createSpace);
spaceRouter.get("/", getSpaces);
spaceRouter.patch("/:spaceId", updateSpace);
spaceRouter.put("/:spaceId/add-members", addMembers);
spaceRouter.put("/:spaceId/remove-members", removeMembers);
spaceRouter.get("/:spaceId/members", getMembers);
spaceRouter.use("/:spaceId/chat", spaceChatRoutes);
spaceRouter.use("/:spaceId/board", boardRoutes);
spaceRouter.use("/:spaceId/row", rowRoutes);

module.exports = spaceRouter;
