const spaceRouter = require("express").Router();

const { createSpace, getSpace, updateSpace, addMembers } = require("../controllers/space");

spaceRouter.post("/", createSpace);
spaceRouter.get("/", getSpace);
spaceRouter.patch("/:spaceId", updateSpace);
spaceRouter.put("/:spaceId/add-members", addMembers);

module.exports = spaceRouter;
