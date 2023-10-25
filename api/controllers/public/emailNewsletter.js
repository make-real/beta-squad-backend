const EmailNewsletter = require("../../../models/EmailNewsletter");
const { isValidEmail } = require("../../../utils/func");

/**
 * Add Newsletter Email
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.addNewsletterEmail = async (req, res, next) => {
	try {
		const issue = {};
		let { email } = req.body;

		if (email) {
			email = String(email).replace(/  +/g, "").trim().toLowerCase();
			const emailLengthOk = email.length < 40;
			if (emailLengthOk) {
				if (isValidEmail(email)) {
					const exists = await EmailNewsletter.exists({ email });
					if (!exists) {
						const structure = new EmailNewsletter({ email });
						const newsletter = await structure.save();

						return res.status(201).json({ message: "Successfully saved email!", data: newsletter });
					} else {
						issue.email = "This email is already in stored!";
					}
				} else {
					issue.email = "Please enter valid email address!";
				}
			} else {
				issue.email = "Email length is too long!";
			}
		} else {
			issue.email = "Please provide an email!";
		}

		res.status(400).json({ issue });
	} catch (error) {
		next(error);
	}
};
