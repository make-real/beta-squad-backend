// Destructuring environment variables

const { v4: uuid } = require("uuid");
const UserSession = require("../models/UserSession");
const AdminSession = require("../models/AdminSession");

function isValidEmail(email) {
	const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
	const allowChars = /^[0-9a-zA-Z_@.]+$/;
	const validEmail = re.test(email) && allowChars.test(email);
	return validEmail;
}

async function usernameGenerating(email, model, forbiddenUsernames) {
	const User = require("../models/User");
	model = model || User;
	forbiddenUsernames = forbiddenUsernames || ["account", "accounts", "user", "users", "admin", "admins", "api"];
	const targetOfSlice = email.indexOf("@");
	let username = email.slice(0, targetOfSlice);
	let usernameExist = await model.findOne({ username });
	let IsForbiddenUsernames = forbiddenUsernames.includes(username);

	if (usernameExist || IsForbiddenUsernames) {
		let increment = 1;
		while (true) {
			var u = username + increment;
			usernameExist = await model.findOne({ username: u });
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

// get specific random digits
function randomDigit(length) {
	let result = "";
	const characters = "0123456789";
	const charactersLength = characters.length;
	for (let i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result;
}

async function userLoginSessionCreate(userId, expireInDay) {
	expireInDay = expireInDay || 30;

	const sessionUUID = uuid();
	const expireDate = new Date();
	expireDate.setDate(expireDate.getDate() + expireInDay);

	const sessionStructure = new UserSession({
		user: userId,
		sessionName: "UserLoginSession",
		sessionUUID,
		expireDate,
	});

	const session = await sessionStructure.save();
	return session;
}

async function userSessionCreate(userId, sessionName, length, expireInMinutes) {
	const getRandomDigit = randomDigit(length);

	const expireDate = new Date();
	expireDate.setMinutes(expireDate.getMinutes() + expireInMinutes);
	const sessionStructure = new UserSession({
		user: userId,
		sessionName,
		sessionUUID: uuid(),
		expireDate,
		code: getRandomDigit,
	});
	const session = await sessionStructure.save();
	return session;
}

async function adminLoginSessionCreate(adminId, expireInDay) {
	expireInDay = expireInDay || 30;

	const sessionUUID = uuid();
	const expireDate = new Date();
	expireDate.setDate(expireDate.getDate() + expireInDay);

	const sessionStructure = new AdminSession({
		admin: adminId,
		sessionName: "AdminLoginSession",
		sessionUUID,
		expireDate,
	});

	const session = await sessionStructure.save();
	return session;
}

async function adminSessionCreate(adminId, sessionName, length, expireInMinutes) {
	const getRandomDigit = randomDigit(length);

	const expireDate = new Date();
	expireDate.setMinutes(expireDate.getMinutes() + expireInMinutes);
	const sessionStructure = new AdminSession({
		admin: adminId,
		sessionName,
		sessionUUID: uuid(),
		expireDate,
		code: getRandomDigit,
	});
	const session = await sessionStructure.save();
	return session;
}

const cardKeyGen = async (spaceId) => {
	const Space = require("../models/Space");
	const Card = require("../models/Card");
	const space = await Space.findOne({ _id: spaceId }).select("name");
	let spaceName = space.name;
	spaceName = spaceName.replace(/[^\p{L}\s]+/gu, "").replace(/\s+/g, "");

	let cardKey = spaceName.slice(0, 3).toUpperCase();
	if (cardKey.length < 3) {
		if (cardKey.length === 2) {
			cardKey = `${cardKey}A`;
		} else if (cardKey.length === 1) {
			cardKey = `${cardKey}AB`;
		}
	}
	cardKey = `${cardKey}-`;

	const highest = await Card.findOne({ spaceRef: spaceId }).sort({ createdAt: -1 }).select("cardKey");
	let num = highest?.cardKey?.slice(4, highest.cardKey.length) || 0;
	num = parseInt(num, 10);
	cardKey = `${cardKey}${num + 1}`;

	return cardKey;
};

const getLastMomentOfCurrentMonth = () => {
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth() + 1;
	const lastMomentOfTheMonth = new Date(year, month, 1, 0, 0, 0, 0);
	lastMomentOfTheMonth.setSeconds(lastMomentOfTheMonth.getSeconds() - 1);
	return lastMomentOfTheMonth;
};

function getNextMonthFirstMoment() {
	const currentDate = new Date();
	// Calculate the next month
	const nextMonth = (currentDate.getMonth() + 1) % 12;

	// If the next month is January, update the year as well
	const nextYear = nextMonth === 0 ? currentDate.getFullYear() + 1 : currentDate.getFullYear();

	// Set the date to the first day of the next month
	const nextMonthDate = new Date(nextYear, nextMonth, 1, 0, 0, 0, 0);

	return nextMonthDate;
}

function updateToNextMonth(timestamp) {
	const currentDate = new Date(timestamp);

	// Get the current month and year
	let currentMonth = currentDate.getMonth();
	let currentYear = currentDate.getFullYear();

	// Calculate the next month
	currentMonth = (currentMonth + 1) % 12;

	// If the next month is January, update the year as well
	if (currentMonth === 0) {
		currentYear++;
	}

	// Set the month and year of the currentDate to the next month and year
	currentDate.setMonth(currentMonth);
	currentDate.setFullYear(currentYear);

	return currentDate;
}

module.exports = { isValidEmail, usernameGenerating, splitSpecificParts, generatePassword, hexAColorGen, randomDigit, userLoginSessionCreate, userSessionCreate, adminLoginSessionCreate, adminSessionCreate, cardKeyGen, getNextMonthFirstMoment, updateToNextMonth };
