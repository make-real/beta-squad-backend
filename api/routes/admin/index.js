const adminRouter = require("express").Router();

const { getAdminProfile } = require("../../controllers/admin");
const userRoutes = require("./user");

adminRouter.get("/", getAdminProfile);
adminRouter.use("/users", userRoutes);

module.exports = adminRouter;
