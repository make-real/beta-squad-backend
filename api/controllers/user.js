const { isValidObjectId } = require("mongoose");
const User = require("../../models/User");

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
