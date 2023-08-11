const userRouter = require("express").Router();

const { getUsersList } = require("../../controllers/admin/user");

userRouter.get("/", getUsersList);

module.exports = userRouter;
