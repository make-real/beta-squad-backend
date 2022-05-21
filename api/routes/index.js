const router = require("express").Router();

const userAuthRoutes = require("./userLoginRegister");
const userRoutes = require("./user");
const { userAuthorization } = require("../../middleware/authorization");

router.use("/user-auth", userAuthRoutes);
router.use("/user", userAuthorization, userRoutes);

module.exports = router;
