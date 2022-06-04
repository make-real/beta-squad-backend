const calendarRouter = require("express").Router({ mergeParams: true });

const { getCardsDate } = require("../../controllers/space/calendar");

calendarRouter.get("/", getCardsDate);

module.exports = calendarRouter;
