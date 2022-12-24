const notificationRouter = require("express").Router();

const { notificationsGet } = require("../controllers/notification");

notificationRouter.get("/", notificationsGet);

module.exports = notificationRouter;
