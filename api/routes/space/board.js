const multipart = require("connect-multiparty");
const boardRouter = require("express").Router({ mergeParams: true });

const { createList, getList, editList, createCard, getDataOfSingleCard, updateCard } = require("../../controllers/space/board");

boardRouter.post("/", createList);
boardRouter.get("/", getList);
boardRouter.patch("/:listId", editList);

///////// CARD ///////////////
boardRouter.post("/:listId/card", createCard);
boardRouter.get("/:listId/card/:cardId", getDataOfSingleCard);
boardRouter.patch("/:listId/card/:cardId", multipart(), updateCard);

module.exports = boardRouter;
