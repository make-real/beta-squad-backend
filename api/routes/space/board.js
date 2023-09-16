const multipart = require("connect-multiparty");
const boardRouter = require("express").Router({ mergeParams: true });

const { contentPermission } = require("../../../middleware/authorize");

const { createList, getLists, editList, deleteList, orderOrSortList, createCard, getCards, getSingleCard, updateCard, moveCard, copyCard, deleteCard, orderOrSortCard, createChecklistItem, updateChecklistItem, deleteChecklistItem, createComment, getComments, commentsEdit, commentsDelete, commentsReaction } = require("../../controllers/space/board");

boardRouter.post("/", contentPermission(["owner", "admin", "user"]), createList);
boardRouter.get("/", getLists);
boardRouter.patch("/:listId", contentPermission(["owner", "admin", "user"]), editList);
boardRouter.delete("/:listId", contentPermission(["owner", "admin", "user"]), deleteList);
boardRouter.put("/:listId/order", contentPermission(["owner", "admin", "user"]), orderOrSortList);

///////// CARD ///////////////
boardRouter.post("/:listId/card", contentPermission(["owner", "admin", "user"]), createCard);
boardRouter.get("/:listId/card", getCards);
boardRouter.get("/:listId/card/:cardId", getSingleCard);
boardRouter.patch("/:listId/card/:cardId", multipart(), contentPermission(["owner", "admin", "user"]), updateCard);
boardRouter.delete("/:listId/card/:cardId", contentPermission(["owner", "admin", "user"]), deleteCard);
boardRouter.put("/:listId/card/:cardId/move", contentPermission(["owner", "admin", "user"]), moveCard);
boardRouter.copy("/:listId/card/:cardId/copy", contentPermission(["owner", "admin", "user"]), copyCard);
boardRouter.put("/:listId/card/:cardId/order", contentPermission(["owner", "admin", "user"]), orderOrSortCard);

///////// CARD Checklist ///////////////
boardRouter.post("/:listId/card/:cardId/checklist", contentPermission(["owner", "admin", "user"]), createChecklistItem);
boardRouter.patch("/:listId/card/:cardId/checklist/:checklistId", contentPermission(["owner", "admin", "user"]), updateChecklistItem);
boardRouter.delete("/:listId/card/:cardId/checklist/:checklistId", contentPermission(["owner", "admin", "user"]), deleteChecklistItem);

///////// Comments ///////////////
boardRouter.post("/:listId/card/:cardId/comment", multipart(), contentPermission(["owner", "admin", "user"]), createComment);
boardRouter.get("/:listId/card/:cardId/comment", getComments);
boardRouter.patch("/:listId/card/:cardId/comment/:commentId", contentPermission(["owner", "admin", "user"]), commentsEdit);
boardRouter.delete("/:listId/card/:cardId/comment/:commentId", contentPermission(["owner", "admin", "user"]), commentsDelete);
boardRouter.put("/:listId/card/:cardId/comment/:commentId", commentsReaction);

module.exports = boardRouter;
