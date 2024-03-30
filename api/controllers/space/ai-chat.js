const { isValidObjectId, Types } = require("mongoose");
const Space = require("../../../models/Space");
const aiChatHistory = require("../../../models/ai-chat");
const Workspace = require("../../../models/Workspace");

exports.saveAiMessage = async (req, res, next) => {
	const spaceId = req.params.spaceId;
	const { message, successMessage, failedMessage } = req.body;
	const user = req.user;
	try {
		let issue = {};
		const isValidSpaceId = isValidObjectId(spaceId);

		if (successMessage) {
			for (const message of successMessage) {
				const { error } = new aiChatHistory(message).validateSync();
				if (error) {
					issue.message = error.message;
				}
			}
		}

		if (failedMessage) {
			for (const message of failedMessage) {
				const { error } = new aiChatHistory(message).validateSync();
				if (error) {
					return res.status(400).send(error.message);
				}
			}
		}

		if (isValidSpaceId) {
			const existSpace = await Space.findOne({ _id: spaceId }).select("workSpaceRef");
			if (existSpace) {
				const imIMemberOfTheWorkspace = await Workspace.findOne({
					$and: [
						{ _id: existSpace.workSpaceRef },
						{
							teamMembers: {
								$elemMatch: {
									member: req.user._id,
								},
							},
						},
					],
				});

				const AmIinSpace = await Space.exists({ $and: [{ _id: spaceId }, { "members.member": user._id }] });
				if (imIMemberOfTheWorkspace) {
					if (AmIinSpace) {
						const newAiChat = new aiChatHistory({
							message: message,
							spaceRef: spaceId,
							workSpaceRef: existSpace.workSpaceRef,
							sender: user._id,
							successMessage,
							failedMessage,
						});
						const saveChatHistory = await newAiChat.save();
						if (saveChatHistory) {
							res.status(201).json({
								message: "message saved successfully",
								data: saveChatHistory,
							});
						}
					} else {
						issue.message = "You are not in this space";
					}
				} else {
					issue.message = "You are not in this workspace";
				}
			} else {
				issue.message = "Space doesn't exists";
			}
		} else {
			issue.message = "Not a valid obj ID";
		}
		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (error) {
		next(error);
	}
};

exports.getAiChatHistory = async (req, res, next) => {
	let { spaceId } = req.params;
	const user = req.user;
	const issue = {};
	let { skip, limit } = req.query;
	limit = parseInt(limit) || 20;
	skip = parseInt(skip) || 0;
	try {
		const isValidSpaceId = isValidObjectId(spaceId);
		if (isValidSpaceId) {
			const spaceExists = await Space.findOne({ _id: spaceId }).select("workSpaceRef");
			if (spaceExists) {
				const imIMemberOfTheWorkspace = await Workspace.findOne({
					$and: [
						{ _id: spaceExists.workSpaceRef },
						{
							teamMembers: {
								$elemMatch: {
									member: req.user._id,
								},
							},
						},
					],
				});
				const AmIinSpace = await Space.exists({ $and: [{ _id: spaceId }, { "members.member": user._id }] });
				if (imIMemberOfTheWorkspace) {
					if (AmIinSpace) {
						const getTheMessages = await aiChatHistory.aggregate([
							{ $match: { $and: [{ spaceRef: Types.ObjectId(spaceExists._id) }, { workSpaceRef: Types.ObjectId(spaceExists.workSpaceRef) }] } },
							{
								$sort: { createdAt: -1 },
							},
							{
								$skip: skip,
							},
							{
								$limit: limit,
							},
							{
								$lookup: {
									from: "users",
									localField: "sender",
									foreignField: "_id",
									as: "sender",
									pipeline: [{ $project: { fullName: 1, _id: 0, avatar: 1 } }],
								},
							},
							{
								$project: {
									spaceRef: 1,
									message: 1,
									sender: 1,
									createdAt: 1,
									successMessage: 1,
									failedMessage: 1,
								},
							},
						]);
						if (getTheMessages) {
							res.status(200).json({
								data: getTheMessages,
							});
						}
					} else {
						issue.message = "You are not a member of this Space";
					}
				} else {
					issue.message = "You are not a member of this WorkSpace";
				}
			} else {
				issue.message = "Space doesn't exists";
			}
		} else {
			issue.message = "Invalid Obj Id";
		}
		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (error) {
		next(error);
	}
};
