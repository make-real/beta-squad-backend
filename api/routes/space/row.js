const rowRouter = require("express").Router({ mergeParams: true });

const { getCardsAsRows } = require("../../controllers/space/row");

rowRouter.get("/", getCardsAsRows);

module.exports = rowRouter;
