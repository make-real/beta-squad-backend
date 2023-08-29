const userRouter = require("express").Router();

const { getUsersList, getSingleUser, deleteSingleUser } = require("../../controllers/admin/user");

userRouter.get("/", getUsersList);
userRouter.get("/:userId", getSingleUser);
userRouter.delete("/:userId", deleteSingleUser);

module.exports = userRouter;
