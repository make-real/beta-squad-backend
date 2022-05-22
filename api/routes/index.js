const router = require("express").Router();

const userAuthRoutes = require("./userLoginRegister");
const { userAuthorization } = require("../../middleware/authorization");
const userRoutes = require("./user");
const workspaceRoutes = require("./workspace");

router.use("/user-auth", userAuthRoutes);
router.use("/user", userAuthorization, userRoutes);
router.use("/workspaces", userAuthorization, workspaceRoutes);

module.exports = router;
