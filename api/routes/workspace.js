const workspaceRouter = require("express").Router();
const multipart = require("connect-multiparty");

const { contentPermission } = require("../../middleware/authorize");

const { createWorkspace, getWorkspaces, getSingleWorkspace, updateWorkspace, deleteWorkspace, addTeamMembers, teamMembers, teamMemberDataUpdateInWorkspace, roleChangeAndRemoveTeamMembers, ownerShipTransferOfWorkspace, leaveFromWorkspace, settingsUpdate, getSettings, createTags, getTags, editTags, deleteTags } = require("../controllers/workspace");
const chatRoutes = require("./chat");

workspaceRouter.post("/", multipart(), createWorkspace);
workspaceRouter.get("/", getWorkspaces);
workspaceRouter.get("/:workspaceId", getSingleWorkspace);
workspaceRouter.patch("/:workspaceId", contentPermission(["owner", "admin"]), multipart(), updateWorkspace);
workspaceRouter.delete("/:workspaceId", contentPermission(["owner"]), deleteWorkspace);
workspaceRouter.put("/:workspaceId/add-team-members", contentPermission(["owner", "admin"]), addTeamMembers);
workspaceRouter.get("/:workspaceId/team-members", teamMembers);
workspaceRouter.patch("/:workspaceId/team-members/:memberId", contentPermission(["owner", "admin"]), teamMemberDataUpdateInWorkspace);
workspaceRouter.put("/:workspaceId/member-role", contentPermission(["owner", "admin"]), roleChangeAndRemoveTeamMembers);
workspaceRouter.patch("/:workspaceId/ownership-transfer", contentPermission(["owner"]), ownerShipTransferOfWorkspace);
workspaceRouter.put("/:workspaceId/leave", leaveFromWorkspace);
workspaceRouter.patch("/:workspaceId/settings", settingsUpdate);
workspaceRouter.get("/:workspaceId/settings", getSettings);

// Tag CRUD
workspaceRouter.post("/:workspaceId/tags", contentPermission(["owner", "admin"]), createTags);
workspaceRouter.get("/:workspaceId/tags", getTags);
workspaceRouter.patch("/:workspaceId/tags/:tagId", contentPermission(["owner", "admin"]), editTags);
workspaceRouter.delete("/:workspaceId/tags/:tagId", contentPermission(["owner", "admin"]), deleteTags);
workspaceRouter.use("/:workspaceId/chat/", contentPermission(["owner", "admin", "user", "guest"]), chatRoutes);

module.exports = workspaceRouter;
