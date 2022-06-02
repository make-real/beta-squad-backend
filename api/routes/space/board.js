const boardRouter = require("express").Router({ mergeParams: true });

const { createList, getList } = require("../../controllers/space/board");

boardRouter.post("/", createList);
boardRouter.get("/", getList);

module.exports = boardRouter;
