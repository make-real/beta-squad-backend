const { isValidObjectId } = require("mongoose");
const Space = require("../../../models/Space");
const List = require("../../../models/List");
const Card = require("../../../models/Card");

exports.createList = async (req, res, next) => {
	let { spaceId } = req.params;
	let { name } = req.body;
	try {
		const user = req.user;
		const issue = {};

		if (name) {
			name = String(name)
				.replace(/\r\n/g, " ")
				.replace(/[\r\n]/g, " ")
				.replace(/  +/g, " ")
				.trim();

			if (isValidObjectId(spaceId)) {
				const existsSpace = await Space.exists({ _id: spaceId });
				if (existsSpace) {
					const doIHaveAccess = await Space.exists({ $and: [{ _id: spaceId }, { "members.member": user._id }] });
					if (doIHaveAccess) {
						const isDuplicate = await List.exists({ $and: [{ spaceRef: spaceId }, { name: new RegExp(`^${name}$`, "i") }] });
						if (!isDuplicate) {
							const listStructure = new List({
								name,
								spaceRef: spaceId,
								creator: user._id,
							});
							const createList = await listStructure.save();
							res.status(201).json({ list: createList });
						} else {
							issue.message = "Couldn't create a duplicate list in the same space!";
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
		} else {
			issue.message = "Please provide a name to create a list!";
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

exports.getList = async (req, res, next) => {
	let { spaceId } = req.params;
	let { skip, limit } = req.query;
	try {
		limit = parseInt(limit) || 20;
		skip = parseInt(skip) || 0;
		const user = req.user;
		const issue = {};

		if (isValidObjectId(spaceId)) {
			const existsSpace = await Space.exists({ _id: spaceId });
			if (existsSpace) {
				const doIHaveAccess = await Space.exists({ $and: [{ _id: spaceId }, { "members.member": user._id }] });
				if (doIHaveAccess) {
					let getLists = await List.find({ spaceRef: spaceId }).sort({ createdAt: -1 }).select("name").skip(skip).limit(limit);
					getLists = JSON.parse(JSON.stringify(getLists));
					for (const list of getLists) {
						const getCards = await Card.find({ listRef: list._id }).select("name description progress tags startDate endDate").populate({
							path: "tags",
							select: "name color",
						});
						list.cards = getCards;
					}
					res.json({ lists: getLists });
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

exports.createCard = async (req, res, next) => {
	let { spaceId, listId } = req.params;
	let { name } = req.body;
	try {
		const user = req.user;
		const issue = {};

		if (name) {
			name = String(name)
				.replace(/\r\n/g, " ")
				.replace(/[\r\n]/g, " ")
				.replace(/  +/g, " ")
				.trim();

			const isValidSpaceId = isValidObjectId(spaceId);
			const isValidListId = isValidObjectId(listId);
			if (isValidSpaceId && isValidListId) {
				const existsSpace = await Space.exists({ _id: spaceId });
				if (existsSpace) {
					const doIHaveAccess = await Space.exists({ $and: [{ _id: spaceId }, { "members.member": user._id }] });
					if (doIHaveAccess) {
						const existsList = await List.exists({ _id: listId });
						if (existsList) {
							const isListOfTheSpace = await List.exists({ $and: [{ _id: listId }, { spaceRef: spaceId }] });
							if (isListOfTheSpace) {
								const isDuplicate = await Card.exists({ $and: [{ listRef: listId }, { name: new RegExp(`^${name}$`, "i") }] });
								if (!isDuplicate) {
									const cardStructure = new Card({
										name,
										spaceRef: spaceId,
										listRef: listId,
										creator: user._id,
									});
									const createCard = await cardStructure.save();
									res.status(201).json({ card: createCard });
								} else {
									issue.message = "Couldn't create a card with duplicate name in the same list!";
								}
							} else {
								issue.message = "Something is wrong!";
							}
						} else {
							issue.message = "Not found the list!";
						}
					} else {
						issue.message = "You have no access to this space!";
					}
				} else {
					issue.message = "Not found space!";
				}
			} else {
				if (!isValidSpaceId) {
					issue.message = "Invalid space id!";
				} else if (!isValidListId) {
					issue.message = "Invalid list id!";
				}
			}
		} else {
			issue.message = "Please provide a name to create a card!";
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};
