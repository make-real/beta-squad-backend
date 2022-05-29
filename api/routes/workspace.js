const workspaceRouter = require("express").Router();
const multipart = require("connect-multiparty");

const { createWorkspace, getWorkspace, updateWorkspace, addTeamMembers } = require("../controllers/workspace");

workspaceRouter.post("/", createWorkspace);
workspaceRouter.get("/", getWorkspace);
workspaceRouter.patch("/:workspaceId", multipart(), updateWorkspace);
workspaceRouter.put("/:workspaceId/add-team-members", addTeamMembers);

module.exports = workspaceRouter;
