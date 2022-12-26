const userAuthRouter = require("express").Router();

const { login, register, accountVerification, resendVerificationCode, logout } = require("../controllers/userLoginRegister");

userAuthRouter.post("/login", login);
userAuthRouter.post("/sign-up", register);
userAuthRouter.post("/account-verification", accountVerification);
userAuthRouter.post("/resend-verification-code", resendVerificationCode);
userAuthRouter.delete("/logout", logout);

module.exports = userAuthRouter;
