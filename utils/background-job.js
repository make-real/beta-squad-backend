const schedule = require("node-schedule");
const UserSession = require("../models/UserSession");

// Unnecessary session clear Weekly/Sunday
schedule.scheduleJob({ dayOfWeek: 0 }, async function () {
	await UserSession.deleteMany({ expireDate: { $lt: new Date() } });
});
