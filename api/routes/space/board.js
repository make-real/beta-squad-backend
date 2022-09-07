const multipart = require("connect-multiparty");
const boardRouter = require("express").Router({ mergeParams: true });

const { createList, getLists, editList, deleteList, createCard, getCards, getSingleCard, updateCard, moveCard, copyCard, deleteCard, createChecklistItem, updateChecklistItem, deleteChecklistItem, createComment, getComments, commentsEdit, commentsDelete } = require("../../controllers/space/board");

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
boardRouter.delete("/:listId/card/:cardId/delete", deleteCard);

///////// CARD Checklist ///////////////
boardRouter.post("/:listId/card/:cardId/checklist", createChecklistItem);
boardRouter.patch("/:listId/card/:cardId/checklist/:checklistId", updateChecklistItem);
boardRouter.delete("/:listId/card/:cardId/checklist/:checklistId", deleteChecklistItem);

///////// Comments ///////////////
boardRouter.post("/:listId/card/:cardId/comment", multipart(), createComment);
boardRouter.get("/:listId/card/:cardId/comment", getComments);
boardRouter.patch("/:listId/card/:cardId/comment/:commentId", commentsEdit);
boardRouter.delete("/:listId/card/:cardId/comment/:commentId", commentsDelete);

module.exports = boardRouter;
