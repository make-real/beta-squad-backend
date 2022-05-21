// Destructuring environment variables
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SERVICE_SID_CODE_4, TWILIO_SERVICE_SID_CODE_6, OTP_ENABLE } = process.env;

const twilio = require("twilio")(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

/**
 * Send OTP via email or sms.
 *
 * @param {("email"|"sms")} via - which channel used to send otp.
 * @param {string} to If channel is email then its an email address else its phone number.
 * @param {6|4} codeSize You can set code size 4 or 6. default = 6
 * @returns {{ accepted: boolean, issue: string }} A object with property 'accepted' and 'issue'. Note: if accepted = true then issue = undefined
 */
async function sendOtpVia(via = "email", to, codeSize = 6) {
	try {
		if (OTP_ENABLE !== "true") {
			return { accepted: true };
		}

		const otpSend = await twilio.verify.services(codeSize === 6 ? TWILIO_SERVICE_SID_CODE_6 : TWILIO_SERVICE_SID_CODE_4).verifications.create({ to, channel: via });

		if (otpSend.status === "pending") {
			return { accepted: true };
		} else {
			return { accepted: false };
		}
	} catch (error) {
		console.log(error);
		return { accepted: false, issue: error.message };
	}
}

/**
 * Verify OTP
 *
 * @param {!string} to where this code was found?
 * @param {!string} code what is the code?
 * @param {() =>} next express callback.
 * @param {6|4} codeSize You can set code size = 6 or 4. default = 6.
 * @returns {boolean} If verify success then true otherwise false.
 */
async function verifyOtp(to, otp, next, codeSize = 6) {
	try {
		if (OTP_ENABLE !== "true") {
			return true;
		}

		const checkedResult = await twilio.verify.services(codeSize === 6 ? TWILIO_SERVICE_SID_CODE_6 : TWILIO_SERVICE_SID_CODE_4).verificationChecks.create({ to, code: otp.toString() });

		if (checkedResult && checkedResult.status === "approved") {
			return true;
		} else {
			return false;
		}
	} catch (error) {
		next(error);
	}
}

function isValidEmail(email) {
	const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
	const allowChars = /^[0-9a-zA-Z_@.]+$/;
	const validEmail = re.test(email) && allowChars.test(email);
	return validEmail;
}

module.exports = { sendOtpVia, verifyOtp, isValidEmail };
