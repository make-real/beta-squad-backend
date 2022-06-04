const { isValidObjectId } = require("mongoose");
const Space = require("../../../models/Space");
const Card = require("../../../models/Card");

exports.getCardsDate = async (req, res, next) => {
	let { spaceId } = req.params;
	let { skip, limit, startDate, endDate, sortBy, sort } = req.query;
	try {
		limit = parseInt(limit) || undefined;
		skip = parseInt(skip) || 0;

		const user = req.user;
		const issue = {};

		if (isValidObjectId(spaceId)) {
			const existsSpace = await Space.exists({ _id: spaceId });
			if (existsSpace) {
				const doIHaveAccess = await Space.exists({ $and: [{ _id: spaceId }, { "members.member": user._id }] });
				if (doIHaveAccess) {
					let startDateOk, endDateOk;

					let startDateQuery = {};
					// check startDate
					if (startDate) {
						if (String(Number(startDate)) !== "NaN") {
							startDate = Number(startDate);
						}
						const validTimestamp = new Date(startDate).getTime() > 0;
						if (validTimestamp) {
							startDate = new Date(startDate);
							startDateQuery = { startDate: { $gte: startDate } };
							startDateOk = true;
						} else {
							issue.startDate = "Please provide the valid timestamp of start date!";
						}
					} else {
						startDateOk = true;
					}

					let endDateQuery = {};
					// check endDate
					if (endDate) {
						if (String(Number(endDate)) !== "NaN") {
							endDate = Number(endDate);
						}
						const validTimestamp = new Date(endDate).getTime() > 0;
						if (validTimestamp) {
							endDate = new Date(endDate);
							endDateQuery = { endDate: { $lte: endDate } };
							endDateOk = true;
						} else {
							issue.endDate = "Please provide the valid timestamp of end date!";
						}
					} else {
						endDateOk = true;
					}

					if (startDateOk && endDateOk) {
						if (sort) {
							sort = String(sort).toLowerCase();
							if (sort === "des" || sort === "descending") {
								sort = -1;
							} else {
								sort = 1;
							}
						}

						const getCards = await Card.find({ $and: [{ spaceRef: spaceId }, startDateQuery, endDateQuery] })
							.select("name startDate endDate spaceRef listRef")
							.sort({ createdAt: sort })
							.skip(skip)
							.limit(limit);

						return res.json({ cards: getCards });
					}
				} else {
					issue.message = "You have no access to this space!";
				}
			} else {
				issue.message = "Not found space!";
			}
		} else {
			issue.message = "Invalid space id!";
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};
