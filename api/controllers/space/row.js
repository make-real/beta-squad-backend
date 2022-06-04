const { isValidObjectId } = require("mongoose");
const Space = require("../../../models/Space");
const Card = require("../../../models/Card");

exports.getCardsAsRows = async (req, res, next) => {
	let { spaceId } = req.params;
	let { skip, limit, sortBy, sort } = req.query;
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
					let sortObj = {};
					if (sortBy) {
						sortBy = String(sortBy).toLowerCase();
						sort = String(sort).toLowerCase();

						if (sort === "des" || sort === "descending") {
							sort = -1;
						} else {
							sort = 1;
						}

						if (sortBy === "name") {
							sortObj = { name: sort };
						} else if (sortBy === "date") {
							sortObj = { createdAt: sort };
						} else if (sortBy === "progress") {
							sortObj = { progress: sort };
						}
					}

					const getCards = await Card.find({ spaceRef: spaceId })
						.select("name progress tags startDate endDate spaceRef listRef")
						.sort(sortObj)
						.populate([
							{
								path: "tags",
								select: "name color",
							},
							{
								path: "listRef",
								select: "name",
							},
							{
								path: "assignee",
								select: "fullName username avatar",
							},
						])
						.skip(skip)
						.limit(limit);

					return res.json({ cards: getCards });
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
