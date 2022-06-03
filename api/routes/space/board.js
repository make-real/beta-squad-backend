const multipart = require("connect-multiparty");
const boardRouter = require("express").Router({ mergeParams: true });

const { createList, getList, createCard, updateCard } = require("../../controllers/space/board");

boardRouter.post("/", createList);
boardRouter.get("/", getList);
boardRouter.post("/:listId/card", createCard);
boardRouter.patch("/:listId/card/:cardId", multipart(), updateCard);

module.exports = boardRouter;
