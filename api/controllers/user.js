const { isValidObjectId } = require("mongoose");
const User = require("../../models/User");

/**
 * Get user list or search users with fullName and email
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.getUsers = async (req, res, next) => {
	let { query: search, limit, skip } = req.query;
	try {
		limit = parseInt(limit) || 20;
		skip = parseInt(skip) || 0;
		const user = req.user;

		let query = {};
		if (search) {
			function es(str) {
				return str.replace(/[-\/\\^$*+?()|[\]{}]/g, "");
			}
			const KeyWordRegExp = new RegExp(".*" + es(search) + ".*", "i"); // Match any word

			query = { $and: [{ $or: [{ fullName: KeyWordRegExp }, { email: KeyWordRegExp }, { phone: KeyWordRegExp }] }, { _id: { $ne: user._id } }] };
		} else {
			query = { _id: { $ne: user._id } };
		}

		const getUsers = await User.find(query).select("fullName avatar").sort({ createdAt: -1 }).skip(skip).limit(limit);
		return res.send({ users: getUsers });
	} catch (err) {
		next(err);
	}
};

/**
 * Get profile data of an user
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.usersProfile = async (req, res, next) => {
	try {
		const { userId } = req.params;
		const issue = {};
		if (userId) {
			if (isValidObjectId(userId)) {
				const getUser = await User.findOne({ _id: userId });
				if (getUser) {
					res.json({ user: getUser });
				} else {
					issue.message = "Not found user!";
				}
			} else {
				issue.message = "Invalid user id!";
			}
		} else {
			req.user.emailVerified = undefined;
			req.user.phoneVerified = undefined;
			res.json({ user: req.user });
		}

		if (!req.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};
