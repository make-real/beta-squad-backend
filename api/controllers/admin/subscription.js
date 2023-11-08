const { isValidObjectId } = require("mongoose");
const User = require("../../../models/User");
const Subscription = require("../../../models/Subscription");

/**
 * Get All users Subscriptions list
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.getAllSubscriptions = async (req, res, next) => {
	let { userId, type, includeUpcomingSub, limit, skip } = req.query;
	try {
		limit = parseInt(limit) || 20;
		skip = parseInt(skip) || 0;

		let query = {};
		if (!includeUpcomingSub) {
			query.startDate = { $lt: new Date() };
		}

		if (userId) {
			if (isValidObjectId(userId)) {
				query.user = userId;
			} else {
				return res.status(400).json({ issue: { userId: "Invalid object id!" } });
			}
		}

		if (type) {
			type = String(type).toUpperCase();
			if (["PAID_SUB", "TRIAL_SUB"].includes(type)) {
				query.type = type;
			} else {
				return res.status(400).json({ issue: { type: "Only valid types are 'PAID_SUB' and 'TRIAL_SUB'!" } });
			}
		}

		let subscriptions = await Subscription.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);

		const subscriptionCount = await Subscription.countDocuments(query);

		return res.json({ subscriptions, subscriptionCount });
	} catch (err) {
		next(err);
	}
};

/**
 * Create a Subscription
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.createSubscription = async (req, res, next) => {
	try {
		const issue = {};

		let { userId, paid, amount, startDate, expiredDate } = req.body;
		let userIdOk, paidOk, amountOk, startDateOk, expiredDateOk;

		if (isValidObjectId(userId)) {
			const user = await User.findOne({ _id: userId });
			if (user) {
				userIdOk = true;
			} else {
				issue.userId = "Not found user with obj ID";
			}
		} else {
			issue.userId = "Invalid user obj ID";
		}

		if (paid === true || paid === false) {
			paidOk = true;
		} else if (paid === undefined || paid === "") {
			paid = undefined;
			paidOk = true;
		} else {
			issue.paid = "Invalid value provided!";
		}

		if (amount !== undefined || amount !== "") {
			amount = Number(amount);
			if (amount) {
				amountOk = true;
			} else {
				issue.amount = "Invalid amount!";
			}
		} else {
			amount = undefined;
			amountOk = true;
		}

		// startDate validation
		if (startDate) {
			if (String(Number(startDate)) !== "NaN") {
				startDate = Number(startDate);
			}

			const validTimestamp = new Date(startDate).getTime() > 0;
			if (validTimestamp) {
				startDateOk = true;
			} else {
				issue.startDate = "Please provide valid date";
			}
		} else {
			startDate = undefined;
			startDateOk = true;
		}

		// expiredDate validation
		if (expiredDate) {
			if (String(Number(expiredDate)) !== "NaN") {
				expiredDate = Number(expiredDate);
			}

			const validTimestamp = new Date(expiredDate).getTime() > 0;
			if (validTimestamp) {
				expiredDateOk = true;
			} else {
				issue.expiredDate = "Please provide valid date";
			}
		} else {
			expiredDate = undefined;
			expiredDateOk = true;
		}

		if (userIdOk && paidOk && amountOk && startDateOk && expiredDateOk) {
			const subscriptionStructure = new Subscription({
				type: "PAID_SUB",
				user: userId,
				paid,
				amount,
				startDate,
				expiredDate,
			});

			const data = await subscriptionStructure.save();

			return res.json({ data: data });
		}

		res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};

/**
 * Update a Subscription
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.updateSubscription = async (req, res, next) => {
	try {
		const issue = {};

		let { subscriptionId } = req.params;
		let { paid, amount, stop, startDate, expiredDate } = req.body;
		let subscriptionIdOk, paidOk, amountOk, stopOk, startDateOk, expiredDateOk;

		if (isValidObjectId(subscriptionId)) {
			const subscription = await Subscription.findOne({ _id: subscriptionId });
			if (subscription) {
				subscriptionIdOk = true;
			} else {
				issue.subscriptionId = "Not found any doc with the obj ID";
			}
		} else {
			issue.subscriptionId = "Invalid obj ID";
		}

		if (paid === true || paid === false) {
			paidOk = true;
		} else if (paid === undefined || paid === "") {
			paid = undefined;
			paidOk = true;
		} else {
			issue.paid = "Invalid value provided!";
		}

		if (amount !== undefined || amount !== "") {
			amount = Number(amount);
			if (amount) {
				amountOk = true;
			} else {
				issue.amount = "Invalid amount!";
			}
		} else {
			amount = undefined;
			amountOk = true;
		}

		if (stop === true || stop === false) {
			stopOk = true;
		} else if (stop === undefined || stop === "") {
			stop = undefined;
			stopOk = true;
		} else {
			issue.stop = "Invalid value provided!";
		}

		// startDate validation
		if (startDate) {
			if (String(Number(startDate)) !== "NaN") {
				startDate = Number(startDate);
			}

			const validTimestamp = new Date(startDate).getTime() > 0;
			if (validTimestamp) {
				startDateOk = true;
			} else {
				issue.startDate = "Please provide valid date";
			}
		} else {
			startDate = undefined;
			startDateOk = true;
		}

		// expiredDate validation
		if (expiredDate) {
			if (String(Number(expiredDate)) !== "NaN") {
				expiredDate = Number(expiredDate);
			}

			const validTimestamp = new Date(expiredDate).getTime() > 0;
			if (validTimestamp) {
				expiredDateOk = true;
			} else {
				issue.expiredDate = "Please provide valid date";
			}
		} else {
			expiredDate = undefined;
			expiredDateOk = true;
		}

		if (subscriptionIdOk && paidOk && amountOk && stopOk && startDateOk && expiredDateOk) {
			await Subscription.updateOne(
				{ _id: subscriptionId },
				{
					paid,
					amount,
					stop,
					startDate,
					expiredDate,
				}
			);

			const getUpdated = await Subscription.findOne({ _id: subscriptionId });
			return res.json({ data: getUpdated });
		}

		res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};
