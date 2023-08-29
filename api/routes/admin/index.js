const adminRouter = require("express").Router();

const { getAdminList, getAdminProfile, getSingleAdminData } = require("../../controllers/admin");
const userRoutes = require("./user");

adminRouter.use("/users", userRoutes);
adminRouter.get("/", getAdminList);
adminRouter.get("/profile", getAdminProfile);
adminRouter.get("/:adminId", getSingleAdminData);

module.exports = adminRouter;
