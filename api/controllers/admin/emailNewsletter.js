const EmailNewsletter = require("../../../models/EmailNewsletter");

/**
 * get Newsletter Email
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.getNewsletterEmails = async (req, res, next) => {
	let { limit, skip } = req.query;
	try {
		limit = parseInt(limit) || 20;
		skip = parseInt(skip) || 0;

		const getEmailNewsletters = await EmailNewsletter.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit);

		return res.json({ data: getEmailNewsletters });
	} catch (err) {
		next(err);
	}
};
