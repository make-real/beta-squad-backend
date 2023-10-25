const publicRouter = require("express").Router();

const emailNewsletterRoutes = require("./emailNewsletter");

publicRouter.use("/email-newsletters", emailNewsletterRoutes);

module.exports = publicRouter;
