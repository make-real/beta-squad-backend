const emailNewsletterRouter = require("express").Router();

const { addNewsletterEmail } = require("../../controllers/public/emailNewsletter");

emailNewsletterRouter.post("/", addNewsletterEmail);

module.exports = emailNewsletterRouter;
