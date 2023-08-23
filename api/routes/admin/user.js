const userRouter = require("express").Router();

const { getUsersList, getSingleUser } = require("../../controllers/admin/user");

userRouter.get("/", getUsersList);
userRouter.get("/:userId", getSingleUser);

module.exports = userRouter;
