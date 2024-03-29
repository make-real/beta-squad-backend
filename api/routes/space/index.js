const spaceRouter = require("express").Router();

const { contentPermission } = require("../../../middleware/authorize");

const { createSpace, getSpaces, getSpaceDetails, updateSpace, deleteSpace, addMembers, removeMembers, getMembers } = require("../../controllers/space");
const spaceChatRoutes = require("./chat");
const boardRoutes = require("./board");
const rowRoutes = require("./row");
const calendarRoutes = require("./calendar");
const spaceFileRoutes = require("./spaceFile");
const aiChatRouter = require("./ai-chat");

spaceRouter.post("/", contentPermission(["owner"]), createSpace);
spaceRouter.get("/", getSpaces);
spaceRouter.get("/:spaceId", getSpaceDetails);
spaceRouter.patch("/:spaceId", contentPermission(["owner", "admin", "manager"]), updateSpace);
spaceRouter.delete("/:spaceId", contentPermission(["owner"]), deleteSpace);
spaceRouter.put("/:spaceId/add-members", contentPermission(["owner", "admin", "manager"]), addMembers);
spaceRouter.put("/:spaceId/remove-members", contentPermission(["owner", "admin", "manager"]), removeMembers);
spaceRouter.get("/:spaceId/members", getMembers);
spaceRouter.use("/:spaceId/chat", contentPermission(["owner", "admin", "user", "guest"]), spaceChatRoutes);
spaceRouter.use("/:spaceId/board", boardRoutes);
spaceRouter.use("/:spaceId/ai-chat", aiChatRouter);
spaceRouter.use("/:spaceId/row", rowRoutes);
spaceRouter.use("/:spaceId/calendar", calendarRoutes);
spaceRouter.use("/:spaceId/files", spaceFileRoutes);

module.exports = spaceRouter;
