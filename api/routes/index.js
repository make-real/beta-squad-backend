const router = require("express").Router();

const adminAuthRoutes = require("./adminLoginRegister");
const adminRoutes = require("./admin");
const userAuthRoutes = require("./userLoginRegister");
const { userAuthorization, adminAuthorization } = require("../../middleware/authorization");
const userRoutes = require("./user");
const workspaceRoutes = require("./workspace");
const spaceRoutes = require("./space");
const notificationRoutes = require("./notification");

router.use("/admin-auth", adminAuthRoutes);
router.use("/admin", adminAuthorization, adminRoutes);
router.use("/user-auth", userAuthRoutes);
router.use("/users", userAuthorization, userRoutes);
router.use("/workspaces", userAuthorization, workspaceRoutes);
router.use("/spaces", userAuthorization, spaceRoutes);
router.use("/notification", userAuthorization, notificationRoutes);

module.exports = router;
