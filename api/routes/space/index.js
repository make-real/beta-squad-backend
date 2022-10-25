const spaceRouter = require("express").Router();

const { createSpace, getSpaces, getSpaceDetails, updateSpace, deleteSpace, addMembers, removeMembers, getMembers } = require("../../controllers/space");
const spaceChatRoutes = require("./chat");
const boardRoutes = require("./board");
const rowRoutes = require("./row");
const calendarRoutes = require("./calendar");

spaceRouter.post("/", createSpace);
spaceRouter.get("/", getSpaces);
spaceRouter.get("/:spaceId", getSpaceDetails);
spaceRouter.patch("/:spaceId", updateSpace);
spaceRouter.delete("/:spaceId", deleteSpace);
spaceRouter.put("/:spaceId/add-members", addMembers);
spaceRouter.put("/:spaceId/remove-members", removeMembers);
spaceRouter.get("/:spaceId/members", getMembers);
spaceRouter.use("/:spaceId/chat", spaceChatRoutes);
spaceRouter.use("/:spaceId/board", boardRoutes);
spaceRouter.use("/:spaceId/row", rowRoutes);
spaceRouter.use("/:spaceId/calendar", calendarRoutes);

module.exports = spaceRouter;
