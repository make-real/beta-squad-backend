const { isValidObjectId } = require("mongoose");
const { phone: phoneNumberValidator } = require("phone");
const { v4: uuid } = require("uuid");
const bcrypt = require("bcrypt");
const { verifyGoogleToken } = require("../../utils/firebase/auth");

const User = require("../../models/User");
const UserSession = require("../../models/UserSession");

const { isValidEmail, usernameGenerating, generatePassword, userLoginSessionCreate, userSessionCreate } = require("../../utils/func");
const { createToken, parseJWT } = require("../../utils/jwt");
const { mailSendWithDynamicTemplate, verificationCodeMatch } = require("../../utils/mail");

/**
 * Login an user
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.login = async (req, res, next) => {
	let { email, password, googleAuthToken } = req.body;
	try {
		let issue = {};

		let emailOk, passwordOk, googleAuthTOkenOk, isUserExists;
		if (email) {
			email = String(email).replace(/\s+/g, "").trim().toLowerCase();
			isUserExists = await User.findOne({ $and: [{ email }, { guest: { $ne: true } }] }).select("+password +emailVerified +phoneVerified");
			if (isUserExists) {
				isUserExists = JSON.parse(JSON.stringify(isUserExists));
				emailOk = true;
			} else {
				issue.email = "There is no associated account with the email!";
			}
		} else {
			issue.email = "Please enter your email or phone!";
		}

		if (password) {
			if (isUserExists) {
				const matched = bcrypt.compareSync(password, isUserExists.password);
				isUserExists.password = undefined;
				if (matched) {
					passwordOk = true;
				} else {
					issue.password = "Password is wrong!";
				}
			}
		} else {
			issue.password = "Please enter your password!";
		}

		let decodeData;
		if (googleAuthToken) {
			decodeData = await verifyGoogleToken(googleAuthToken);
			if (!decodeData.error) {
				googleAuthTOkenOk = true;
			} else {
				issue = { googleAuthToken: decodeData.error };
			}
		}

		if ((emailOk && passwordOk) || googleAuthTOkenOk) {
			if (googleAuthTOkenOk) {
				const userExists = await User.findOne({ email: decodeData.email }).select("+emailVerified +phoneVerified +guest");

				let password = generatePassword(8);
				const salt = bcrypt.genSaltSync(11);
				password = bcrypt.hashSync(password, salt);
				if (userExists) {
					isUserExists = JSON.parse(JSON.stringify(userExists));

					if (isUserExists.guest) {
						await User.deleteOne({ _id: isUserExists._id });
						delete isUserExists.createdAt;
						delete isUserExists.updatedAt;
						delete isUserExists.guest;

						const userStructure = new User({
							...isUserExists,
							fullName: decodeData.fullName,
							phone: decodeData.phone,
							password,
							avatar: decodeData.picture,
							emailVerified: true,
						});
						isUserExists = await userStructure.save();
					} else {
						await User.updateOne({ _id: isUserExists._id }, { emailVerified: true });
						isUserExists.emailVerified = true;
					}
				} else {
					const userStructure = new User({
						fullName: decodeData.fullName,
						username: await usernameGenerating(decodeData.email),
						email: decodeData.email,
						phone: decodeData.phone,
						password,
						avatar: decodeData.picture,
						emailVerified: true,
					});
					const saveUser = await userStructure.save();
					isUserExists = saveUser;
				}

				if (!userExists || isUserExists.guest) {
					const dynamicTemplateData = {
						name: decodeData.fullName,
					};
					mailSendWithDynamicTemplate(decodeData.email, process.env.TEMPLATE_ID_WELCOME_MAIL, dynamicTemplateData);
				}
			}

			const loginSession = await userLoginSessionCreate(isUserExists._id);

			const jwtToken = createToken(loginSession._id, loginSession.sessionUUID);
			const loggedUser = {
				_id: isUserExists._id,
				fullName: isUserExists.fullName,
				username: isUserExists.username,
				email: isUserExists.email,
				emailVerified: isUserExists.emailVerified,
				phoneVerified: isUserExists.phoneVerified,
				avatar: isUserExists.avatar,
				lastOnline: isUserExists.lastOnline,
			};
			res.json({ jwtToken, loggedUser });
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

/**
 * Sign up an user
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.register = async (req, res, next) => {
	let { fullName, email, phone, password } = req.body;
	try {
		const issue = {};

		let fullNameOk, emailOk, phoneOk, passwordOk;
		// Full name check
		if (fullName) {
			const letters = /^[A-Za-z\s]+$/; // Name char validation
			fullName = String(fullName).replace(/  +/g, " ").trim();
			const validFirstName = fullName.match(letters);
			if (validFirstName) {
				fullNameOk = true;
			} else {
				issue.fullName = "Full name is not valid!";
			}
		} else {
			issue.fullName = "Please enter your first name!";
		}

		// check email
		if (email) {
			email = String(email).replace(/\s+/g, "").trim().toLowerCase();
			const emailLengthOk = email.length < 40;
			if (emailLengthOk) {
				if (isValidEmail(email)) {
					const emailExist = await User.exists({ $and: [{ email }, { guest: { $ne: true } }] });
					var guestUserExists = await User.findOne({ $and: [{ email }, { guest: true }] }).select("+emailVerified +phoneVerified +guest");
					if (!emailExist) {
						/* username generating */
						var username = await usernameGenerating(email);
						emailOk = true;
					} else {
						issue.email = "An account has already associated with the email!";
					}
				} else {
					issue.email = "Please enter valid email address!";
				}
			} else {
				issue.email = "Email length is too long!";
			}
		} else {
			issue.email = "Please enter your email address!";
		}

		// check phone
		if (phone) {
			const validateNumber = phoneNumberValidator(phone);
			if (validateNumber.isValid) {
				phone = validateNumber.phoneNumber;
				const phoneExist = await User.exists({ phone });
				if (!phoneExist) {
					phoneOk = true;
				} else {
					issue.phone = "An account has already associated with the phone!";
				}
			} else {
				issue.phone = "Invalid phone number!";
			}
		} else {
			phone = undefined;
			phoneOk = true;
		}

		if (password) {
			if (password.length >= 8 && password.length <= 32) {
				const strongPasswordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,32}$/;
				const passwordStrong = password.match(strongPasswordRegex);
				if (passwordStrong) {
					const salt = bcrypt.genSaltSync(11);
					password = bcrypt.hashSync(password, salt);
					passwordOk = true;
				} else {
					issue.password = "Please enter strong password!";
				}
			} else {
				issue.password = "Password length should be 8 to 32 characters long!";
			}
		} else {
			issue.password = "Please enter new password!";
		}

		if (fullNameOk && emailOk && phoneOk && passwordOk) {
			if (guestUserExists?.guest) {
				guestUserExists = JSON.parse(JSON.stringify(guestUserExists));

				await User.deleteOne({ _id: guestUserExists._id });
				delete guestUserExists.createdAt;
				delete guestUserExists.updatedAt;
				delete guestUserExists.guest;

				var userStructure = new User({
					...guestUserExists,
					fullName,
					email,
					phone,
					password,
				});
			} else {
				userStructure = new User({
					fullName,
					username,
					email,
					phone,
					password,
				});
			}

			const getSession = await userSessionCreate(userStructure._id, "email-verification", 6, 15);

			const dynamicTemplateData = {
				name: fullName,
				code: getSession.code,
			};
			const codeSendResponse = await mailSendWithDynamicTemplate(email, process.env.TEMPLATE_ID_EMAIL_VERIFY, dynamicTemplateData);

			if (codeSendResponse.status === 200) {
				await userStructure.save();

				const session = {
					sessionUUID: getSession.sessionUUID,
					expireDate: getSession.expireDate,
				};

				res.status(201).json({ message: "Successfully registered!", userId: userStructure._id, session });
				const dynamicTemplateData = {
					name: fullName,
				};
				await mailSendWithDynamicTemplate(email, process.env.TEMPLATE_ID_WELCOME_MAIL, dynamicTemplateData);
			} else {
				let m = codeSendResponse.status ? codeSendResponse : { message: codeSendResponse.message };
				return res.status(codeSendResponse.status || 400).json({ issue: m });
			}
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

/**
 * Account email address verification
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */

exports.accountVerification = async (req, res, next) => {
	let { sessionUUID, code } = req.body;

	try {
		const issue = {};
		let sessionIdOk, codeOk;
		let session, userExist;
		if (sessionUUID) {
			session = await UserSession.findOne({ $and: [{ sessionUUID }, { sessionName: "email-verification" }] }).populate({
				path: "user",
				select: "email emailVerified",
			});

			if (session) {
				if (session.expireDate > new Date()) {
					if (session.user) {
						userExist = session.user;
						sessionIdOk = true;
					} else {
						issue.message = "Not found user!";
					}
				} else {
					issue.message = "Session expired!";
				}
			} else {
				issue.message = "Invalid sessionUUID";
			}
		} else {
			issue.message = "Please provide sessionUUID";
		}

		if (code) {
			codeOk = true;
		} else {
			issue.message = "Please provide verification code";
		}

		if (sessionIdOk && codeOk) {
			const IsUserAlreadyVerified = userExist.emailVerified;
			if (!IsUserAlreadyVerified) {
				if (session.wrongCodeTry < 3) {
					if (verificationCodeMatch(session.code, code)) {
						const update = await User.updateOne({ _id: userExist._id }, { emailVerified: true });
						if (update.modifiedCount) {
							await UserSession.deleteOne({ _id: session._id }); // Now delete the session

							const loginSession = await userLoginSessionCreate(userExist._id);

							const jwtToken = createToken(loginSession._id, loginSession.sessionUUID);
							return res.json({ message: "Your email is successfully verified!", jwtToken, loggedUser: userExist._id });
						}
					} else {
						await UserSession.updateOne({ _id: session._id }, { $inc: { wrongCodeTry: 1 } });
						issue.message = "Verification code was wrong! You can try only 3 times with wrong code!";
					}
				} else {
					issue.message = "You have already tried 3 times with the wrong code!";
				}
			} else {
				issue.message = "Your email is already verified";
			}
		}

		return res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};

exports.resendVerificationCode = async (req, res, next) => {
	let { email } = req.body;

	try {
		const issue = {};
		if (email) {
			email = String(email).replace(/\s+/g, "").trim().toLowerCase();
			if (isValidEmail(email)) {
				const user = await User.findOne({ email }).select("email fullName emailVerified");
				if (user) {
					if (!user.emailVerified) {
						await UserSession.deleteMany({ $and: [{ user: user._id }, { sessionName: "email-verification" }] }); // Before create new session, delete old sessions

						const getSession = await userSessionCreate(user._id, "email-verification", 6, 15);

						const dynamicTemplateData = {
							name: user.fullName,
							code: getSession.code,
						};
						const codeSendResponse = await mailSendWithDynamicTemplate(user.email, process.env.TEMPLATE_ID_RESEND_VERIFY_CODE, dynamicTemplateData);
						if (codeSendResponse.status === 200) {
							const session = {
								sessionUUID: getSession.sessionUUID,
								expireDate: getSession.expireDate,
							};
							res.json({
								message: "Successfully re-sent verification code!",
								userId: user._id,
								session,
							});
						} else {
							let m = codeSendResponse.status ? codeSendResponse : { message: codeSendResponse.message };
							res.status(codeSendResponse.status || 400).json({ issue: m });
						}
					} else {
						issue.message = "You are already verified, you don't need to send a code. Just login!";
					}
				} else {
					issue.message = "Not found user!";
				}
			} else {
				issue.message = "Invalid email";
			}
		} else {
			issue.message = "Please provide email";
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};
/**
 * Logout an user
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.logout = async (req, res, next) => {
	try {
		const issue = {};
		let token = req.headers.authorization;
		if (token) {
			token = token.split(" ")[1];
			const jwt_payload = parseJWT(token);
			if (!jwt_payload.error) {
				if (isValidObjectId(jwt_payload.sessionId)) {
					const loginSessionDelete = await UserSession.deleteOne({ $and: [{ _id: jwt_payload.sessionId }, { sessionUUID: jwt_payload.sessionUUID }] });
					if (loginSessionDelete.deletedCount) {
						return res.json({ message: "Successfully Logged Out" });
					} else {
						issue.massage = "Already logged out!";
					}
				} else {
					issue.massage = "Something went wrong!";
				}
			} else {
				issue.message = jwt_payload.error;
			}
		} else {
			issue.massage = "Please provide token!";
		}

		return res.status(400).json({ issue });
	} catch (error) {
		return next(error);
	}
};

/**
 ******************************* Forget password *************************
 */

/**
 * Send code to recover password
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.recoverPassword = async (req, res, next) => {
	let { emailOrPhone } = req.body;
	try {
		const issue = {};

		let emailOrPhoneOk, isUserExists;
		if (emailOrPhone) {
			emailOrPhone = String(emailOrPhone).replace(/\s+/g, "").trim().toLowerCase();
			isUserExists = await User.findOne({ $or: [{ email: emailOrPhone }, { phone: emailOrPhone }] }).select("email fullName");
			if (isUserExists) {
				isUserExists.toObject();
				emailOrPhoneOk = true;
			} else {
				issue.message = "There is no associated account with the email/phone!";
			}
		} else {
			issue.message = "Please enter your email or phone!";
		}

		if (emailOrPhoneOk) {
			await UserSession.deleteMany({ $and: [{ user: isUserExists._id }, { sessionName: "password-recover" }] }); // Before create new session, delete old sessions
			const getSession = await userSessionCreate(isUserExists._id, "password-recover", 6, 15);

			const dynamicTemplateData = {
				name: isUserExists.fullName,
				code: getSession.code,
			};
			const codeSendResponse = await mailSendWithDynamicTemplate(isUserExists.email, process.env.TEMPLATE_ID_FORGET_PASSWORD, dynamicTemplateData);
			if (codeSendResponse.status === 200) {
				const session = {
					sessionUUID: getSession.sessionUUID,
					expireDate: getSession.expireDate,
				};

				res.json({ message: "Code sent successfully to your email!", session });
			} else {
				let m = codeSendResponse.status ? codeSendResponse : { message: codeSendResponse.message };
				res.status(codeSendResponse.status || 400).json({ issue: m });
			}
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

/**
 * Verify code to recover password
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.verifyRecoverCode = async (req, res, next) => {
	let { sessionUUID, code } = req.body;

	try {
		const issue = {};
		let sessionIdOk, codeOk;
		let session;
		if (sessionUUID) {
			session = await UserSession.findOne({ $and: [{ sessionUUID }, { sessionName: "password-recover" }] }).populate({
				path: "user",
				select: "email",
			});

			if (session) {
				if (!session.codeMatched) {
					if (session.expireDate > new Date()) {
						if (session.user) {
							sessionIdOk = true;
						} else {
							issue.message = "Not found user!";
						}
					} else {
						issue.message = "Session expired!";
					}
				} else {
					issue.message = "Session already used!";
				}
			} else {
				issue.message = "Invalid sessionUUID";
			}
		} else {
			issue.message = "Please provide sessionUUID";
		}

		if (code) {
			codeOk = true;
		} else {
			issue.message = "Please provide verification code";
		}

		if (sessionIdOk && codeOk) {
			if (session.wrongCodeTry < 3) {
				if (verificationCodeMatch(session.code, code)) {
					await UserSession.updateOne(
						{ $and: [{ sessionUUID: session.sessionUUID }, { sessionName: "password-recover" }] },
						{
							codeMatched: true,
						}
					);

					const ss = {
						sessionUUID: session.sessionUUID,
						expireDate: session.expireDate,
					};
					return res.json({ message: "Code matched, Now you can reset your password!", session: ss });
				} else {
					await UserSession.updateOne({ _id: session._id }, { $inc: { wrongCodeTry: 1 } });
					issue.message = "Verification code was wrong! You can try only 3 times with wrong code!";
				}
			} else {
				issue.message = "You have already tried 3 times with the wrong code!";
			}
		}

		return res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};

/**
 * Reset password
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.resetPassword = async (req, res, next) => {
	let { sessionUUID, password } = req.body;

	try {
		const issue = {};
		let sessionUUIDOk, passwordOk;
		let getSession, userExist;
		if (sessionUUID) {
			getSession = await UserSession.findOne({ $and: [{ sessionUUID }, { sessionName: "password-recover" }] }).populate({
				path: "user",
				select: "email password",
			});
			if (getSession) {
				userExist = getSession.user;
				if (getSession.expireDate > new Date()) {
					if (getSession.codeMatched) {
						sessionUUIDOk = true;
					} else {
						issue.sessionUUID = "First verify the session with the code you received!";
					}
				} else {
					issue.sessionUUID = "Session expired!";
				}
			} else {
				issue.sessionUUID = "Invalid sessionUUID!";
			}
		} else {
			issue.sessionUUID = "Please provide sessionUUID";
		}

		if (password) {
			if (password.length >= 8 && password.length <= 32) {
				const strongPasswordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,32}$/;
				const passwordStrong = password.match(strongPasswordRegex);
				if (passwordStrong) {
					if (userExist) {
						const isItCurrentPassword = bcrypt.compareSync(password, userExist.password);
						if (!isItCurrentPassword) {
							const salt = bcrypt.genSaltSync(11);
							password = bcrypt.hashSync(password, salt);
							passwordOk = true;
						} else {
							issue.password = "Please use a new password instead of old password!";
						}
					}
				} else {
					issue.password = "Please enter strong password!";
				}
			} else {
				issue.password = "Password length should be 8 to 32 characters long!";
			}
		} else {
			issue.password = "Please enter new password!";
		}

		if (sessionUUIDOk && passwordOk) {
			if (userExist) {
				const updatePassword = await User.updateOne(
					{ _id: userExist._id },
					{
						password,
					}
				);

				if (updatePassword.modifiedCount) {
					await UserSession.deleteOne({ _id: getSession._id }); // Now delete the session

					// Logout from others device
					await UserSession.deleteMany({ $and: [{ user: userExist._id }, { sessionName: "UserLoginSession" }] });

					res.json({ message: "Password successfully recovered!" });
				} else {
					issue.message = "Failed to update password!";
				}
			} else {
				issue.message = "Something is wrong!";
			}
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};
