const spaceRouter = require("express").Router();

const { createSpace, getSpace, updateSpace, addMembers, removeMembers } = require("../controllers/space");

spaceRouter.post("/", createSpace);
spaceRouter.get("/", getSpace);
spaceRouter.patch("/:spaceId", updateSpace);
spaceRouter.put("/:spaceId/add-members", addMembers);
spaceRouter.put("/:spaceId/remove-members", removeMembers);

module.exports = spaceRouter;
