const adminRouter = require("express").Router();

const multipart = require("connect-multiparty");

const { getAdminList, getAdminProfile, getSingleAdminData, updateAdminData } = require("../../controllers/admin");
const userRoutes = require("./user");
const { getAllEmails } = require("../../controllers/email");

adminRouter.use("/users", userRoutes);
adminRouter.get("/", getAdminList);
adminRouter.get("/profile", getAdminProfile);
adminRouter.patch("/profile", multipart(), updateAdminData);
adminRouter.get("/:adminId", getSingleAdminData);
adminRouter.get("/get-early-emails", getAllEmails);

module.exports = adminRouter;
