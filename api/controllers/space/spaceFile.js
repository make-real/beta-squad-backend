const { isValidObjectId } = require("mongoose");

const Space = require("../../../models/Space");
const SpaceFile = require("../../../models/SpaceFile");

exports.addSpaceFile = async (req, res, next) => {
	const user = req.user;
	const { spaceId } = req.params;
	const { title, subtitle, link } = req.body;

	const issue = {};

	let spaceIdOk, titleOk, subtitleOk, linkOk;
	try {
		if (isValidObjectId(spaceId)) {
			const existsSpace = await Space.exists({ _id: spaceId });
			if (existsSpace) {
				spaceIdOk = true;
			} else {
				issue.spaceId = "Not found space with the space id!";
			}
		} else {
			issue.spaceId = "Invalid space ID!";
		}

		if (spaceIdOk) {
			if (title) {
				titleOk = true;
			} else {
				issue.subtitle = "Please provide subtitle!";
			}

			if (subtitle) {
				subtitleOk = true;
			} else {
				subtitleOk = true;
			}

			if (link) {
				const urlRegex = /(https?:\/\/[^\s]+)/g;
				const valid = urlRegex.test(link);
				if (valid) {
					linkOk = true;
				} else {
					issue.link = "Invalid link!";
				}
			} else {
				issue.link = "Please provide link!";
			}

			if (spaceIdOk && titleOk && subtitleOk && linkOk) {
				const spaceFileStructure = new SpaceFile({
					title,
					subtitle,
					link,
					spaceRef: spaceId,
					createdBy: user._id,
				});

				const spaceFile = await spaceFileStructure.save();

				return res.status(201).json({ spaceFile });
			}
		}

		res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};

exports.getSpaceFiles = async (req, res, next) => {
	const user = req.user;
	const { spaceId } = req.params;
	let { search, skip, limit } = req.query;

	const issue = {};

	try {
		limit = parseInt(limit) || 20;
		skip = parseInt(skip) || 0;

		let query = {};
		if (search) {
			function es(str) {
				return str.replace(/[-\/\\^$*+?()|[\]{}]/g, "");
			}
			const KeyWordRegExp = new RegExp(".*" + es(search) + ".*", "i"); // Match any word

			query = { $and: [{ spaceRef: spaceId }, { $or: [{ title: KeyWordRegExp }, { subtitle: KeyWordRegExp }] }] };
		} else {
			query = { spaceRef: spaceId };
		}

		if (isValidObjectId(spaceId)) {
			const space = await Space.exists({ _id: spaceId });
			if (space) {
				const doIHaveAccess = await Space.exists({ $and: [{ _id: spaceId }, { "members.member": user._id }] });
				if (doIHaveAccess) {
					const spaceFiles = await SpaceFile.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);
					return res.json({ spaceFiles });
				} else {
					issue.spaceId = "You have no access to this space!";
				}
			} else {
				issue.spaceId = "Not found space file with the id!";
			}
		} else {
			issue.spaceId = "Invalid space ID!";
		}

		res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};

exports.getSingleSpaceFile = async (req, res, next) => {
	const user = req.user;
	const { spaceId, spaceFileId } = req.params;

	const issue = {};

	try {
		if (isValidObjectId(spaceId)) {
			if (isValidObjectId(spaceFileId)) {
				const spaceFile = await SpaceFile.findOne({ _id: spaceFileId });
				if (spaceFile) {
					const doIHaveAccess = await Space.exists({ $and: [{ _id: spaceFile.spaceRef }, { "members.member": user._id }] });
					if (doIHaveAccess) {
						return res.json({ spaceFile });
					} else {
						issue.spaceId = "You have no access to this space!";
					}
				} else {
					issue.spaceId = "Not found space file with the id!";
				}
			} else {
				issue.spaceFileId = "Invalid space File ID!";
			}
		} else {
			issue.spaceId = "Invalid space ID!";
		}

		res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};

exports.updateSpaceFile = async (req, res, next) => {
	const user = req.user;
	const { spaceId, spaceFileId } = req.params;
	const { title, subtitle, link } = req.body;

	const issue = {};

	let spaceIdOk, spaceFileIdOk, titleOk, subtitleOk, linkOk;
	try {
		if (isValidObjectId(spaceId)) {
			spaceIdOk = true;
		} else {
			issue.spaceId = "Invalid space ID!";
		}

		if (spaceIdOk) {
			if (title) {
				titleOk = true;
			} else {
				title = undefined;
				titleOk = true;
			}

			if (subtitle) {
				subtitleOk = true;
			} else {
				subtitle = undefined;
				subtitleOk = true;
			}

			if (link) {
				const urlRegex = /(https?:\/\/[^\s]+)/g;
				const valid = urlRegex.test(link);
				if (valid) {
					linkOk = true;
				} else {
					issue.link = "Invalid link!";
				}
			} else {
				link = undefined;
				linkOk = true;
			}

			if (spaceIdOk && titleOk && subtitleOk && linkOk) {
				if (isValidObjectId(spaceFileId)) {
					const spaceFile = await SpaceFile.findOne({ _id: spaceFileId }).select("spaceRef");
					if (spaceFile) {
						const doIHaveAccess = await Space.exists({ $and: [{ _id: spaceFile.spaceRef }, { "members.member": user._id }] });
						if (doIHaveAccess) {
							spaceFileIdOk = true;
						} else {
							issue.spaceId = "You have no access to this space!";
						}
					} else {
						issue.spaceId = "Not found space file with the id!";
					}
				} else {
					issue.spaceFileId = "Invalid space File ID!";
				}

				if (spaceFileIdOk) {
					await SpaceFile.updateOne({ _id: spaceFileId }, { title, subtitle, link });

					const updateDate = await SpaceFile.findOne({ _id: spaceFileId });

					return res.json({ spaceFile: updateDate });
				}
			}
		}

		res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};

exports.deleteSpaceFile = async (req, res, next) => {
	const user = req.user;
	const { spaceId, spaceFileId } = req.params;

	const issue = {};

	try {
		if (isValidObjectId(spaceId)) {
			if (isValidObjectId(spaceFileId)) {
				const spaceFile = await SpaceFile.findOne({ _id: spaceFileId }).select("spaceRef");
				if (spaceFile) {
					const doIHaveAccess = await Space.exists({ $and: [{ _id: spaceFile.spaceRef }, { "members.member": user._id }] });
					if (doIHaveAccess) {
						await SpaceFile.deleteOne({ _id: spaceFileId }).select("spaceRef");

						return res.json({ message: "Space file deleted successfully!" });
					} else {
						issue.spaceId = "You have no access to this space!";
					}
				} else {
					issue.spaceId = "Already may deleted!";
				}
			} else {
				issue.spaceFileId = "Invalid space File ID!";
			}
		} else {
			issue.spaceId = "Invalid space ID!";
		}

		res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};
