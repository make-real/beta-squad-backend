const { isValidObjectId, Types } = require("mongoose");
const Space = require("../../../models/Space");
const Card = require("../../../models/Card");

exports.getCardsAsRows = async (req, res, next) => {
	let { spaceId } = req.params;
	let { skip, limit, sortBy, sort, search } = req.query;
	try {
		limit = parseInt(limit) || 10;
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
						} else {
							sortObj = { createdAt: sort };
						}
					} else {
						sortObj = { createdAt: -1 };
					}

					let searchQuery = {};
					if (search) {
						const KeyWordRegExp = new RegExp("^" + search.replace(/[-\/\\^$*+?()|[\]{}]/g, ""), "i"); // Match from starting
						searchQuery = { name: KeyWordRegExp };
					}

					let getCards = await Card.aggregate([
						{ $match: { $and: [{ spaceRef: Types.ObjectId(spaceId) }, searchQuery] } },
						{
							$sort: sortObj,
						},
						{
							$skip: skip,
						},
						{
							$limit: limit,
						},
						{
							$lookup: {
								from: "tags",
								localField: "tags",
								foreignField: "_id",
								as: "tags",
								pipeline: [{ $project: { name: 1, color: 1 } }],
							},
						},
						{
							$lookup: {
								from: "lists",
								localField: "listRef",
								foreignField: "_id",
								as: "listRef",
								pipeline: [{ $project: { name: 1 } }],
							},
						},
						{
							$lookup: {
								from: "checklists",
								localField: "checkList",
								foreignField: "_id",
								as: "checkList",
								pipeline: [{ $project: { content: 1, checked: 1, spaceRef: 1, cardRef: 1 } }],
							},
						},
						{
							$lookup: {
								from: "users",
								localField: "assignee",
								foreignField: "_id",
								as: "assignee",
								pipeline: [{ $project: { fullName: 1, username: 1, avatar: 1 } }],
							},
						},
						{
							$lookup: {
								from: "commentchats",
								localField: "_id",
								foreignField: "to",
								as: "commentchats",
								pipeline: [{ $project: { _id: 1 } }],
							},
						},
						{
							$project: {
								name: 1,
								progress: 1,
								description: 1,
								tags: 1,
								checkList: 1,
								assignee: 1,
								startDate: 1,
								endDate: 1,
								order: 1,
								spaceRef: 1,
								listRef: 1,
								color: 1,
								commentsCount: { $size: "$commentchats" },
								attachmentsCount: { $size: "$attachments" },
								seen: {
									$cond: {
										if: { $in: [user._id, "$seenBy"] },
										then: true,
										else: false,
									},
								},
							},
						},
					]);

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
