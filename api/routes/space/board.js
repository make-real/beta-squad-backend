const boardRouter = require("express").Router({ mergeParams: true });

const { createList, getList, createCard } = require("../../controllers/space/board");

boardRouter.post("/", createList);
boardRouter.get("/", getList);
boardRouter.post("/:listId/card", createCard);

module.exports = boardRouter;
