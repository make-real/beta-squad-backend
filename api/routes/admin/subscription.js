const subscriptionRouter = require("express").Router();

const { getAllSubscriptions, createSubscription, updateSubscription } = require("../../controllers/admin/subscription");

subscriptionRouter.get("/", getAllSubscriptions);
subscriptionRouter.post("/", createSubscription);
subscriptionRouter.patch("/:subscriptionId", updateSubscription);

module.exports = subscriptionRouter;
