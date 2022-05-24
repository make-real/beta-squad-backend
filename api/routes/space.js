const spaceRouter = require("express").Router();

const { createSpace, getSpace } = require("../controllers/space");

spaceRouter.post("/", createSpace);
spaceRouter.get("/", getSpace);

module.exports = spaceRouter;
