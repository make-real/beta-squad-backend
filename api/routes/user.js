const userRouter = require("express").Router();
const multipart = require("connect-multiparty");

const { getUsers, usersProfile, updateProfile } = require("../controllers/user");

userRouter.get("/", getUsers);
userRouter.get("/profile", usersProfile);
userRouter.get("/profile/:userId", usersProfile);
userRouter.patch("/profile", multipart(), updateProfile);

module.exports = userRouter;
