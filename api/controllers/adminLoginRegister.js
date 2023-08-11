const { isValidObjectId } = require("mongoose");
const bcrypt = require("bcrypt");

const Admin = require("../../models/Admin");
const AdminSession = require("../../models/AdminSession");

const { isValidEmail, usernameGenerating, adminLoginSessionCreate, adminSessionCreate } = require("../../utils/func");
const { createToken, parseJWT } = require("../../utils/jwt");

/**
 * Login an admin
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.login = async (req, res, next) => {
	let { email, password } = req.body;
	try {
		let issue = {};

		let emailOk, passwordOk, isAdminExists;
		if (email) {
			email = String(email).replace(/\s+/g, "").trim().toLowerCase();
			isAdminExists = await Admin.findOne({ email }).select("+password");
			if (isAdminExists) {
				isAdminExists = JSON.parse(JSON.stringify(isAdminExists));
				emailOk = true;
			} else {
				issue.email = "There is no associated account with the email!";
			}
		} else {
			issue.email = "Please enter your email or phone!";
		}

		if (password) {
			if (isAdminExists) {
				const matched = bcrypt.compareSync(password, isAdminExists.password);
				isAdminExists.password = undefined;
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
			const loginSession = await adminLoginSessionCreate(isAdminExists._id);

			const jwtToken = createToken(loginSession._id, loginSession.sessionUUID);
			const loggedAdmin = {
				_id: isAdminExists._id,
				name: isAdminExists.name,
				username: isAdminExists.username,
				email: isAdminExists.email,
				avatar: isAdminExists.avatar,
			};
			res.json({ jwtToken, loggedAdmin });
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

/**
 * Sign up an admin
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.register = async (req, res, next) => {
	let { name, email, password } = req.body;
	try {
		const issue = {};

		let nameOk, emailOk, passwordOk;
		// Name check
		if (name) {
			const letters = /^[A-Za-z\s]+$/; // Name char validation
			name = String(name).replace(/  +/g, " ").trim();
			const validFirstName = name.match(letters);
			if (validFirstName) {
				nameOk = true;
			} else {
				issue.name = "Name is not valid!";
			}
		} else {
			issue.name = "Please enter your name!";
		}

		// check email
		if (email) {
			email = String(email).replace(/\s+/g, "").trim().toLowerCase();
			const emailLengthOk = email.length < 40;
			if (emailLengthOk) {
				if (isValidEmail(email)) {
					const emailExist = await Admin.exists({ email });
					if (!emailExist) {
						/* username generating */
						var username = await usernameGenerating(email, Admin);
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

		if (nameOk && emailOk && passwordOk) {
			const adminStructure = new Admin({
				name,
				username,
				email,
				password,
			});

			const getSession = await adminSessionCreate(adminStructure._id, "email-verification", 6, 15);

			await adminStructure.save();

			const session = {
				sessionUUID: getSession.sessionUUID,
				expireDate: getSession.expireDate,
			};

			res.status(201).json({ message: "Successfully registered!", adminId: adminStructure._id, session });
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

/**
 * Logout an admin
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
					const loginSessionDelete = await AdminSession.deleteOne({ $and: [{ _id: jwt_payload.sessionId }, { sessionUUID: jwt_payload.sessionUUID }] });
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
