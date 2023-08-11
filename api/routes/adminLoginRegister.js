const adminAuthRouter = require("express").Router();

const { login, register, logout } = require("../controllers/adminLoginRegister");

adminAuthRouter.post("/login", login);
adminAuthRouter.post("/sign-up", register);
adminAuthRouter.delete("/logout", logout);

module.exports = adminAuthRouter;
