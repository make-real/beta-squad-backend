const workspaceRouter = require("express").Router();
const multipart = require("connect-multiparty");

const { createWorkspace, getWorkspace, updateWorkspace } = require("../controllers/workspace");

workspaceRouter.post("/", createWorkspace);
workspaceRouter.get("/", getWorkspace);
workspaceRouter.patch("/:workspaceId", multipart(), updateWorkspace);

module.exports = workspaceRouter;
