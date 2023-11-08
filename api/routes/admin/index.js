const adminRouter = require("express").Router();

const multipart = require("connect-multiparty");

const { getAdminList, getAdminProfile, getSingleAdminData, updateAdminData } = require("../../controllers/admin");
const userRoutes = require("./user");
const emailNewsletterRoutes = require("./emailNewsletter");
const subscriptionRoutes = require("./subscription");

adminRouter.use("/users", userRoutes);
adminRouter.use("/email-newsletters", emailNewsletterRoutes);
adminRouter.use("/subscriptions", subscriptionRoutes);
adminRouter.get("/", getAdminList);
adminRouter.get("/profile", getAdminProfile);
adminRouter.patch("/profile", multipart(), updateAdminData);
adminRouter.get("/:adminId", getSingleAdminData);

module.exports = adminRouter;
