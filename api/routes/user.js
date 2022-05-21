const userRouter = require("express").Router();

const { usersProfile } = require("../controllers/user");

userRouter.get("/profile", usersProfile);
userRouter.get("/profile/:userId", usersProfile);

module.exports = userRouter;
