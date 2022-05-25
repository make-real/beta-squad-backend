const router = require("express").Router();

const userAuthRoutes = require("./userLoginRegister");
const { userAuthorization } = require("../../middleware/authorization");
const userRoutes = require("./user");
const workspaceRoutes = require("./workspace");
const spaceRoutes = require("./space");

router.use("/user-auth", userAuthRoutes);
router.use("/users", userAuthorization, userRoutes);
router.use("/workspaces", userAuthorization, workspaceRoutes);
router.use("/spaces", userAuthorization, spaceRoutes);

module.exports = router;
