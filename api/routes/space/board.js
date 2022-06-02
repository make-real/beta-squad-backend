const boardRouter = require("express").Router({ mergeParams: true });

const { createList } = require("../../controllers/space/board");

boardRouter.post("/", createList);

module.exports = boardRouter;
