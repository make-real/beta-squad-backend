const workspaceRouter = require("express").Router();
const multipart = require("connect-multiparty");

const { createWorkspace, getWorkspaces, getSingleWorkspace, updateWorkspace, addTeamMembers, roleChangeAndRemoveTeamMembers, ownerShipTransferOfWorkspace, createTags, getTags, editTags, deleteTags } = require("../controllers/workspace");

workspaceRouter.post("/", createWorkspace);
workspaceRouter.get("/", getWorkspaces);
workspaceRouter.get("/:workspaceId", getSingleWorkspace);
workspaceRouter.patch("/:workspaceId", multipart(), updateWorkspace);
workspaceRouter.put("/:workspaceId/add-team-members", addTeamMembers);
workspaceRouter.put("/:workspaceId/member-role", roleChangeAndRemoveTeamMembers);
workspaceRouter.patch("/:workspaceId/ownership-transfer", ownerShipTransferOfWorkspace);

// Tag CRUD
workspaceRouter.post("/:workspaceId/tags", createTags);
workspaceRouter.get("/:workspaceId/tags", getTags);
workspaceRouter.patch("/:workspaceId/tags/:tagId", editTags);
workspaceRouter.delete("/:workspaceId/tags/:tagId", deleteTags);

module.exports = workspaceRouter;
