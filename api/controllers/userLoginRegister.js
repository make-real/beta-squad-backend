const { isValidObjectId } = require("mongoose");
const { phone: phoneNumberValidator } = require("phone");
const { v4: uuid } = require("uuid");
const bcrypt = require("bcrypt");

const User = require("../../models/User");
const UserSession = require("../../models/UserSession");

const { isValidEmail, sendOtpVia, verifyOtp, usernameGenerating } = require("../../utils/func");
const { createToken, parseJWT } = require("../../utils/jwt");

/**
 * Login an user
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.login = async (req, res, next) => {
	let { email, password } = req.body;
	try {
		const issue = {};

		let emailOk, passwordOk, isUserExists;
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

		if (emailOk && passwordOk) {
			const sessionUUID = uuid();
			const expireDate = new Date();
			expireDate.setDate(expireDate.getDate() + 30);

			const sessionStructure = new UserSession({
				user: isUserExists._id,
				sessionUUID,
				expireDate,
			});

			const session = await sessionStructure.save();

			const jwtToken = createToken(session._id, sessionUUID);
			return res.json({ jwtToken, loggedUser: isUserExists });
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

			const codeSend = await sendOtpVia("email", email);
			if (codeSend.accepted) {
				await userStructure.save();
				return res.status(201).json({ message: "Successfully registered!", userId: userStructure._id });
			} else {
				issue.message = "Failed to send verification code!";
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
	let { userId, code } = req.body;

	try {
		const issue = {};
		let isValidUserId, codeOk;
		if (userId) {
			isValidUserId = isValidObjectId(userId);
		} else {
			issue.message = "Please provide user id";
		}

		if (code) {
			code = Number(code);
			if (String(code) != "NaN") {
				codeOk = true;
			} else {
				issue.message = "Please provide the six digit code!";
			}
		} else {
			issue.message = "Please provide verification code";
		}

		if (isValidUserId && codeOk) {
			const userExist = await User.findOne({ _id: userId }).select("emailVerified");
			if (userExist) {
				if (!userExist.emailVerified) {
					const matchedOtp = verifyOtp(userExist.email, code, next);
					if (matchedOtp) {
						const update = await User.updateOne({ _id: userId }, { emailVerified: true });
						if (update.modifiedCount) {
							return res.json({ message: "Your email is successfully verified!" });
						}
					} else {
						issue.message = "Verification code was wrong!";
					}
				} else {
					issue.message = "Your email is already verified";
				}
			} else {
				issue.message = "There is no user with the id";
			}
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
