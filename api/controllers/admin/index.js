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
