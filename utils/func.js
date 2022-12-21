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

async function usernameGenerating(email, forbiddenUsernames) {
	const User = require("../models/User");
	forbiddenUsernames = forbiddenUsernames || ["account", "accounts", "user", "users", "api"];
	const targetOfSlice = email.indexOf("@");
	let username = email.slice(0, targetOfSlice);
	let usernameExist = await User.findOne({ username });
	let IsForbiddenUsernames = forbiddenUsernames.includes(username);

	if (usernameExist || IsForbiddenUsernames) {
		let increment = 1;
		while (true) {
			var u = username + increment;
			usernameExist = await User.findOne({ username: u });
			IsForbiddenUsernames = forbiddenUsernames.includes(u);
			console.trace("Looping at 'usernameGenerating' func to generate username");

			if (!usernameExist && !IsForbiddenUsernames) {
				break;
			} else {
				increment++;
			}
		}
		username = u;
	}

	return username;
}

function splitSpecificParts(str, startChar, endChar) {
	const targetParts = [];
	const splitWithStartChar = str.split(startChar);

	for (let arrItem of splitWithStartChar) {
		if (arrItem.indexOf(endChar) > -1) {
			const splitEndIndex = arrItem.indexOf(endChar);
			const item = arrItem.substring(0, splitEndIndex);
			targetParts.push(item);
		}
	}

	return targetParts;
}

function generatePassword(length) {
	length = length || 10;
	let charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$_&-+()/*:;!?";
	let retVal = "";
	for (var i = 0, n = charset.length; i < length; ++i) {
		retVal += charset.charAt(Math.floor(Math.random() * n));
	}
	return retVal;
}

function hexAColorGen() {
	function opacity() {
		let min = 3;
		let max = 15;
		let charset = "0123456789abcdef";
		let retVal = "";
		for (let i = 0; i < 2; i++) {
			const randomNum = Math.floor(Math.random() * (max - min + 1) + min);
			retVal += charset.charAt(randomNum);
		}
		return retVal;
	}

	const hexAColor = "000000".replace(/0/g, function () {
		return (~~(Math.random() * 16)).toString(16);
	});
	const color = `#${hexAColor}${opacity()}`;
	return color;
}

module.exports = { sendOtpVia, verifyOtp, isValidEmail, usernameGenerating, splitSpecificParts, generatePassword, hexAColorGen };
