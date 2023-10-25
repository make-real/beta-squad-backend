const adminRouter = require("express").Router();

const multipart = require("connect-multiparty");

const { getAdminList, getAdminProfile, getSingleAdminData, updateAdminData } = require("../../controllers/admin");
const userRoutes = require("./user");

adminRouter.use("/users", userRoutes);
adminRouter.get("/", getAdminList);
adminRouter.get("/profile", getAdminProfile);
adminRouter.patch("/profile", multipart(), updateAdminData);
adminRouter.get("/:adminId", getSingleAdminData);

module.exports = adminRouter;
