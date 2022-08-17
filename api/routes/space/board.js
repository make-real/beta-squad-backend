const multipart = require("connect-multiparty");
const boardRouter = require("express").Router({ mergeParams: true });

const { createList, getLists, editList, deleteList, createCard, getCards, getSingleCard, updateCard, moveCard, copyCard, createChecklistItem, updateChecklistItem, deleteChecklistItem } = require("../../controllers/space/board");

boardRouter.post("/", createList);
boardRouter.get("/", getLists);
boardRouter.patch("/:listId", editList);
boardRouter.delete("/:listId", deleteList);

///////// CARD ///////////////
boardRouter.post("/:listId/card", createCard);
boardRouter.get("/:listId/card", getCards);
boardRouter.get("/:listId/card/:cardId", getSingleCard);
boardRouter.patch("/:listId/card/:cardId", multipart(), updateCard);
boardRouter.put("/:listId/card/:cardId/move", moveCard);
boardRouter.copy("/:listId/card/:cardId/copy", copyCard);

///////// CARD Checklist ///////////////
boardRouter.post("/:listId/card/:cardId/checklist", createChecklistItem);
boardRouter.patch("/:listId/card/:cardId/checklist/:checklistId", updateChecklistItem);
boardRouter.delete("/:listId/card/:cardId/checklist/:checklistId", deleteChecklistItem);

module.exports = boardRouter;
