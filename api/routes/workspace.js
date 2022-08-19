const workspaceRouter = require("express").Router();
const multipart = require("connect-multiparty");

const { createWorkspace, getWorkspaces, getSingleWorkspace, updateWorkspace, deleteWorkspace, addTeamMembers, teamMembers, roleChangeAndRemoveTeamMembers, ownerShipTransferOfWorkspace, leaveFromWorkspace, createTags, getTags, editTags, deleteTags } = require("../controllers/workspace");

workspaceRouter.post("/", createWorkspace);
workspaceRouter.get("/", getWorkspaces);
workspaceRouter.get("/:workspaceId", getSingleWorkspace);
workspaceRouter.patch("/:workspaceId", multipart(), updateWorkspace);
workspaceRouter.delete("/:workspaceId", deleteWorkspace);
workspaceRouter.put("/:workspaceId/add-team-members", addTeamMembers);
workspaceRouter.get("/:workspaceId/team-members", teamMembers);
workspaceRouter.put("/:workspaceId/member-role", roleChangeAndRemoveTeamMembers);
workspaceRouter.patch("/:workspaceId/ownership-transfer", ownerShipTransferOfWorkspace);
workspaceRouter.put("/:workspaceId/leave", leaveFromWorkspace);

// Tag CRUD
workspaceRouter.post("/:workspaceId/tags", createTags);
workspaceRouter.get("/:workspaceId/tags", getTags);
workspaceRouter.patch("/:workspaceId/tags/:tagId", editTags);
workspaceRouter.delete("/:workspaceId/tags/:tagId", deleteTags);

module.exports = workspaceRouter;
