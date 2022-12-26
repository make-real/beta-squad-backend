const { isValidObjectId } = require("mongoose");
const { phone: phoneNumberValidator } = require("phone");
const { v4: uuid } = require("uuid");
const bcrypt = require("bcrypt");
const { verifyGoogleToken } = require("../../utils/firebase/auth");

const User = require("../../models/User");
const UserSession = require("../../models/UserSession");

const { isValidEmail, usernameGenerating, generatePassword, loginSessionCreate, sessionCreate } = require("../../utils/func");
const { createToken, parseJWT } = require("../../utils/jwt");
const { mailSend, verificationCodeMatch } = require("../../utils/mailgun");

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
			email = String(email).replace(/  +/g, "").trim();
			isUserExists = await User.findOne({ email }).select("+password +emailVerified +phoneVerified");
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
				const userExists = await User.findOne({ email: decodeData.email }).select("+emailVerified +phoneVerified");
				if (userExists) {
					isUserExists = userExists;

					if (!isUserExists.emailVerified) {
						await User.updateOne({ _id: userExists._id }, { emailVerified: true });
					}
				} else {
					let password = generatePassword(8);
					const salt = bcrypt.genSaltSync(11);
					password = bcrypt.hashSync(password, salt);

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
			}

			const loginSession = await loginSessionCreate(isUserExists._id);

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
			return res.json({ jwtToken, loggedUser });
		}

		return res.status(400).json({ issue });
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
			email = String(email).replace(/  +/g, "").trim();
			const emailLengthOk = email.length < 40;
			if (emailLengthOk) {
				if (isValidEmail(email)) {
					const emailExist = await User.exists({ email });
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
			const userStructure = new User({
				fullName,
				username,
				email,
				phone,
				password,
			});

			const getSession = await sessionCreate(userStructure._id, "email-verification", 6, 15);

			const subject = "Email verification code.";
			const message = `<span style="font-size:16px;">Please verify your email address, code: <span style="font-weight:bold;">${getSession.code}</span></span>`;

			const codeSendResponse = await mailSend(email, subject, message);

			if (codeSendResponse.status === 200) {
				await userStructure.save();

				const session = {
					sessionUUID: getSession.sessionUUID,
					expireDate: getSession.expireDate,
				};

				return res.status(201).json({ message: "Successfully registered!", userId: userStructure._id, session });
			} else {
				let m = codeSendResponse.status ? codeSendResponse : { message: codeSendResponse.message };
				return res.status(codeSendResponse.status || 400).json({ issue: m });
			}
		}
		return res.status(400).json({ issue });
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

							const loginSession = await loginSessionCreate(userExist._id);

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
			if (isValidEmail(email)) {
				const user = await User.findOne({ email }).select("email emailVerified");
				if (user) {
					if (!user.emailVerified) {
						await UserSession.deleteMany({ $and: [{ user: user._id }, { sessionName: "email-verification" }] }); // Before create new session, delete old sessions

						const getSession = await sessionCreate(user._id, "email-verification", 6, 15);

						const subject = "Re-send email verification code.";
						const message = `<span style="font-size:16px;">Please verify your email address, code: <span style="font-weight:bold;">${getSession.code}</span></span>`;

						const codeSendResponse = await mailSend(user.email, subject, message);
						if (codeSendResponse.status === 200) {
							const session = {
								sessionUUID: getSession.sessionUUID,
								expireDate: getSession.expireDate,
							};
							return res.json({
								message: "Successfully re-sent verification code!",
								userId: user._id,
								session,
							});
						} else {
							let m = codeSendResponse.status ? codeSendResponse : { message: codeSendResponse.message };
							return res.status(codeSendResponse.status || 400).json({ issue: m });
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

		return res.status(400).json({ issue });
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
