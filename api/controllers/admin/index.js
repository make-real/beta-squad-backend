const { isValidObjectId } = require("mongoose");
const bcrypt = require("bcrypt");
const Admin = require("../../../models/Admin");
const AdminSession = require("../../../models/AdminSession");

const { isValidEmail } = require("../../../utils/func");
const { imageCheck, upload } = require("../../../utils/file");
const { parseJWT } = require("../../../utils/jwt");

/**
 * Get admin list
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.getAdminList = async (req, res, next) => {
	let { search, limit, skip } = req.query;
	try {
		limit = parseInt(limit) || 20;
		skip = parseInt(skip) || 0;

		let query = {};
		if (search) {
			function es(str) {
				return str.replace(/[-\/\\^$*+?()|[\]{}]/g, "");
			}
			const KeyWordRegExp = new RegExp(".*" + es(search) + ".*", "i"); // Match any word

			query = { $or: [{ name: KeyWordRegExp }, { username: KeyWordRegExp }, { email: KeyWordRegExp }] };
		}

		const getAdmins = await Admin.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);
		return res.json({ admins: getAdmins });
	} catch (err) {
		next(err);
	}
};

/**
 * Get profile data of an admin
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.getAdminProfile = async (req, res, next) => {
	try {
		return res.json({ admin: req.admin });
	} catch (err) {
		next(err);
	}
};

/**
 * Update admin data
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.updateAdminData = async (req, res, next) => {
	let { name, username, email, currentPassword, newPassword } = req.body;
	try {
		const admin = req.admin;

		const issue = {};

		let nameOk, usernameOk, emailOk, avatarOk, currentPasswordOk, newPasswordOk;

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
			name = undefined;
			nameOk = true;
		}

		// Username check
		if (username) {
			username = String(username).toLowerCase().trim();
			if (username.length <= 46 && username.length >= 3) {
				const usernameRegex = /^[a-zA-Z0-9]+$/;
				if (username.match(usernameRegex)) {
					const startWithNumber = /^\d/.test(username);
					if (!startWithNumber) {
						const usernameExist = await Admin.findOne({ $and: [{ username }, { _id: { $ne: admin._id } }] });
						if (!usernameExist) {
							usernameOk = true;
						} else {
							issue.username = "This username is not available.";
						}
					} else {
						issue.username = "Username can not start with numbers!";
					}
				} else {
					issue.username = "Please only enter uppercase or lower case letters!";
				}
			} else {
				issue.username = "Username could be 3 to 46 characters long!";
			}
		} else {
			username = undefined;
			usernameOk = true;
		}

		// check email
		if (email) {
			email = String(email).replace(/  +/g, "").trim();
			const emailLengthOk = email.length < 40;
			if (emailLengthOk) {
				if (isValidEmail(email)) {
					const emailExist = await Admin.exists({ $and: [{ email }, { _id: { $ne: admin._id } }] });
					if (!emailExist) {
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
			email = undefined;
			emailOk = true;
		}

		// check password
		if (currentPassword || newPassword) {
			if (currentPassword && newPassword) {
				const adminPass = await Admin.findOne({ _id: admin._id }).select("password");
				if (newPassword.length >= 8 && newPassword.length <= 32) {
					const strongPasswordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,32}$/;
					const passwordStrong = newPassword.match(strongPasswordRegex);
					if (passwordStrong) {
						const newPassCurrentPassMatched = bcrypt.compareSync(newPassword, adminPass.password);
						if (!newPassCurrentPassMatched) {
							const salt = bcrypt.genSaltSync(11);
							newPassword = bcrypt.hashSync(newPassword, salt);
							newPasswordOk = true;

							const jwt_payload = parseJWT(req.headers.authorization.split(" ")[1]);
							// Logout from others device
							await AdminSession.deleteMany({ $and: [{ _id: { $ne: jwt_payload.sessionId } }, { admin: admin._id }, { sessionName: "AdminLoginSession" }] });
						} else {
							issue.newPassword = "Current password can not be a new password!";
						}
					} else {
						issue.newPassword = "Please enter strong password!";
					}
				} else {
					issue.newPassword = "Password length should be 8 to 32 characters long!";
				}

				const passwordMatched = bcrypt.compareSync(currentPassword, adminPass.password);
				if (passwordMatched) {
					currentPasswordOk = true;
				} else {
					issue.currentPassword = "Password was wrong!";
				}
			} else {
				if (!newPassword) {
					issue.newPassword = "Please enter new password!";
				} else if (!currentPassword) {
					issue.currentPassword = "Please enter current password!";
				}
			}
		} else {
			currentPassword = undefined;
			newPassword = undefined;
			newPasswordOk = true;
			currentPasswordOk = true;
		}

		if (nameOk && usernameOk && emailOk && currentPasswordOk && newPasswordOk) {
			if (req.files && req.files.avatar) {
				const theAvatar = req.files.avatar;
				const checkImage = imageCheck(theAvatar);
				if (checkImage.status) {
					var uploadResult = await upload(theAvatar.path);
					if (uploadResult.secure_url) {
						avatarOk = true;
						var avatarUrl = uploadResult.secure_url;
					} else {
						issue.avatar = uploadResult.message;
					}
				} else {
					issue.avatar = checkImage.message;
				}
			} else {
				avatarOk = true;
			}

			if (avatarOk) {
				const userUpdate = await Admin.updateOne(
					{ _id: admin._id },
					{
						name,
						username,
						email,
						avatar: avatarUrl,
						password: newPassword,
					}
				);

				if (userUpdate.modifiedCount) {
					const updateData = await Admin.findOne({ _id: admin._id });
					return res.json({ admin: updateData });
				} else {
					issue.message = "Failed to update";
				}
			}
		}

		return res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};

/**
 * Get Single admin data
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.getSingleAdminData = async (req, res, next) => {
	const { adminId } = req.params;
	try {
		const issue = {};

		if (isValidObjectId(adminId)) {
			let getAdmin = await Admin.findOne({ _id: adminId });
			return res.json({ admin: getAdmin });
		} else {
			issue.userId = "Invalid obj Id!";
		}

		res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};
