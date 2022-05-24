const spaceRouter = require("express").Router();

const { createSpace } = require("../controllers/space");

spaceRouter.post("/", createSpace);

module.exports = spaceRouter;
