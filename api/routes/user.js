const userRouter = require("express").Router();

const { getUsers, usersProfile } = require("../controllers/user");

userRouter.get("/", getUsers);
userRouter.get("/profile", usersProfile);
userRouter.get("/profile/:userId", usersProfile);

module.exports = userRouter;
