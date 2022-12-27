const userAuthRouter = require("express").Router();

const { login, register, accountVerification, resendVerificationCode, logout, recoverPassword, verifyRecoverCode, resetPassword } = require("../controllers/userLoginRegister");

userAuthRouter.post("/login", login);
userAuthRouter.post("/sign-up", register);
userAuthRouter.post("/account-verification", accountVerification);
userAuthRouter.post("/resend-verification-code", resendVerificationCode);
userAuthRouter.delete("/logout", logout);
userAuthRouter.post("/recover-password", recoverPassword);
userAuthRouter.post("/recover-password/code", verifyRecoverCode);
userAuthRouter.post("/recover-password/password-reset", resetPassword);

module.exports = userAuthRouter;
