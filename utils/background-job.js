const schedule = require("node-schedule");
const UserSession = require("../models/UserSession");
const User = require("../models/User");
const Subscription = require("../models/Subscription");
const ErrorLog = require("../models/ErrorLog");
const { updateToNextMonth, getNextMonthFirstMoment } = require("../utils/func");

// Unnecessary session clear Weekly/Sunday
schedule.scheduleJob({ dayOfWeek: 0 }, async function () {
	await UserSession.deleteMany({ expireDate: { $lt: new Date() } });
});

// Running the task on the 1st day of every month at 12:00:01 AM
const rule = new schedule.RecurrenceRule();
rule.dayOfMonth = 1;
rule.hour = 0;
rule.minute = 0;
rule.second = 1;
schedule.scheduleJob(rule, async function () {
	try {
		const users = await User.aggregate([
			{ $match: {} },
			{
				$lookup: {
					from: "subscriptions",
					localField: "_id",
					foreignField: "user",
					as: "subscriptions",
					pipeline: [{ $match: { type: "PAID_SUB" } }, { $sort: { createdAt: -1 } }],
				},
			},
			{
				$addFields: {
					subscription: { $ifNull: [{ $arrayElemAt: ["$subscriptions", 0] }, null] },
				},
			},
			{
				$match: {
					subscription: { $ne: null },
				},
			},

			{ $project: { _id: 1, subscription: 1 } },
		]);

		for (const user of users) {
			const startDate = updateToNextMonth(user.subscription.startDate);
			const expiredDate = updateToNextMonth(user.subscription.expiredDate);

			if (new Date(user.subscription.expiredDate) < getNextMonthFirstMoment()) {
				const subscriptionStructure = new Subscription({
					type: "PAID_SUB",
					paid: false,
					user: user._id,
					startDate,
					expiredDate,
				});

				await subscriptionStructure.save();
			}
		}
	} catch (err) {
		console.log(err);
		const errorLogStructure = new ErrorLog({
			error: err,
			description: "Automatic subscriptions create",
		});
		await errorLogStructure.save();
	}
});
