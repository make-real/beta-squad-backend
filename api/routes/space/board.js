const multipart = require("connect-multiparty");
const boardRouter = require("express").Router({ mergeParams: true });

const { createList, getLists, editList, createCard, getCards, getSingleCard, updateCard } = require("../../controllers/space/board");

boardRouter.post("/", createList);
boardRouter.get("/", getLists);
boardRouter.patch("/:listId", editList);

///////// CARD ///////////////
boardRouter.post("/:listId/card", createCard);
boardRouter.get("/:listId/card", getCards);
boardRouter.get("/:listId/card/:cardId", getSingleCard);
boardRouter.patch("/:listId/card/:cardId", multipart(), updateCard);

module.exports = boardRouter;
