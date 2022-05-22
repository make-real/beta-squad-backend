const workspaceRouter = require("express").Router();

const { createWorkspace, getWorkspace } = require("../controllers/workspace");

workspaceRouter.post("/", createWorkspace);
workspaceRouter.get("/", getWorkspace);

module.exports = workspaceRouter;
