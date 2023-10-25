const emailNewsletterRouter = require("express").Router();

const { getNewsletterEmails } = require("../../controllers/admin/emailNewsletter");

emailNewsletterRouter.get("/", getNewsletterEmails);

module.exports = emailNewsletterRouter;
