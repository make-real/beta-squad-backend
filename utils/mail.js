const { isValidEmail } = require("./func");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const SENDGRID_VERIFIED_SENDER = process.env.SENDGRID_VERIFIED_SENDER;

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
				const msg = {
					to: toSend,
					from: {
						name: "Beta Squad",
						email: SENDGRID_VERIFIED_SENDER,
					},
					subject,
					// text: message,
					html: message,
				};

				const result = await sgMail.send(msg);

				return {
					status: result[0]?.statusCode == 202 ? 200 : 400,
				};
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
		error.message = `${error.message} - (sendGrid)`;
		console.log(error);
		return error;
	}
}

async function mailSendWithDynamicTemplate(to, templateId, dynamicTemplateData) {
	if (process.env.MAIL_SEND_ENABLE === "false") {
		return { status: 200 };
	}

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
				const msg = {
					to: toSend,
					from: {
						name: "Beta Squad",
						email: SENDGRID_VERIFIED_SENDER,
					},
					templateId,
					dynamicTemplateData,
				};

				const result = await sgMail.send(msg);

				return {
					status: result[0]?.statusCode == 202 ? 200 : 400,
				};
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
		error.message = `${error.message} - (sendGrid)`;
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

module.exports = { mailSend, mailSendWithDynamicTemplate, verificationCodeMatch };
