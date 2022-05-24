const spaceRouter = require("express").Router();

const { createSpace, getSpace, updateSpace } = require("../controllers/space");

spaceRouter.post("/", createSpace);
spaceRouter.get("/", getSpace);
spaceRouter.patch("/:spaceId", updateSpace);

module.exports = spaceRouter;
