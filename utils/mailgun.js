const { isValidEmail } = require("./func");
const Mailgun = require("mailgun.js");
const formData = require("form-data");
const mailgun = new Mailgun(formData);
const apiKey = process.env.MAILGUN_API_KEY;
const DOMAIN = process.env.MAILGUN_EMAIL_DOMAIN;

async function mailSend(to, subject, message) {
	if (process.env.MAIL_SEND_ENABLE === "false") {
		return { status: 200 };
	}

	subject = subject || "Nothing";
	message = message || "Nothing";
	const issue = {};
	try {
		if (to) {
			let toSend = [];
			if (Array.isArray(to)) {
				toSend = to;
			} else {
				toSend = [to];
			}

			let mainValid;
			for (singleMail of toSend) {
				if (isValidEmail(singleMail)) {
					mainValid = true;
				} else {
					mainValid = false;
					break;
				}
			}

			if (mainValid) {
				const mg = mailgun.client({
					username: "api",
					key: apiKey,
				});
				const result = await mg.messages.create(DOMAIN, {
					from: `Beta Squad <no-replay@${DOMAIN}>`,
					to: toSend,
					subject,
					// text: message,
					html: message,
				});

				return result;
			} else {
				if (mainValid === false) {
					issue.message = "There is an invalid email!";
				} else if (mainValid === undefined) {
					issue.message = "Please provide emails to send email!";
				}
			}
		} else {
			issue.message = "Please provide an email address where you want to send mail!";
		}

		throw new Error(issue.message);
	} catch (error) {
		error.message = `${error.message} - (mailgun)`;
		console.log(error);
		return error;
	}
}

function verificationCodeMatch(userInputCode, sentCode) {
	if (process.env.MAIL_SEND_ENABLE === "false") {
		return true;
	}

	return String(userInputCode) === String(sentCode);
}

module.exports = { mailSend, verificationCodeMatch };
