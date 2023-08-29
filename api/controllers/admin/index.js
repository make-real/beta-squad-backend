const { isValidObjectId } = require("mongoose");
const Admin = require("../../../models/Admin");

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

		const getAdmins = await Admin.find(query).select("name username email avatar role").sort({ createdAt: -1 }).skip(skip).limit(limit);
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
 * Get Single User data of an admin
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
			let getAdmin = await Admin.findOne({ _id: adminId }).select("name username email avatar role");
			return res.json({ admin: getAdmin });
		} else {
			issue.userId = "Invalid obj Id!";
		}

		res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};
