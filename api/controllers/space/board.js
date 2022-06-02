const { isValidObjectId } = require("mongoose");
const Space = require("../../../models/Space");
const List = require("../../../models/List");

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
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};
