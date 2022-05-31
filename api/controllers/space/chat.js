const { isValidObjectId } = require("mongoose");
const Space = require("../../../models/Space");
const SpaceChat = require("../../../models/SpaceChat");
const { splitSpecificParts } = require("../../../utils/func");
const { multipleFilesCHeckAndUpload } = require("../../../utils/file");
const User = require("../../../models/User");

exports.sendMessage = async (req, res, next) => {
	let { textMessage, replayOf } = req.body;
	let mentionedUsers = [],
		attachmentsUrls = [];
	let { spaceId } = req.params;
	try {
		const user = req.user;
		const issue = {};

		let textMessageOk, attachmentsOk, spaceIdOk, replayOfOk;

		// text message check
		if (textMessage) {
			textMessage = String(textMessage).replace(/  +/g, " ").trim();
			const splitIds = splitSpecificParts(textMessage, "{{", "}}");
			const ids = [];
			for (const id of splitIds) {
				if (isValidObjectId(id)) {
					ids.push(id);
				}
			}
			const validMentionedUsers = await User.find({ _id: { $in: ids } }).select("_id");
			for (const user of validMentionedUsers) {
				mentionedUsers.push(user._id);
			}
			textMessageOk = true;
		} else {
			textMessageOk = true;
		}

		// spaceId check
		if (isValidObjectId(spaceId)) {
			const spaceExists = await Space.exists({ _id: spaceId });
			if (spaceExists) {
				const doIHaveAccessToSendMessage = await Space.exists({ $and: [{ _id: spaceId }, { "members.member": user._id }] });
				if (doIHaveAccessToSendMessage) {
					spaceIdOk = true;
				} else {
					issue.spaceId = "You are not a member of the space!!";
				}
			} else {
				issue.spaceId = "Not found space";
			}
		} else {
			issue.spaceId = "Invalid space id";
		}

		// replayOf id check
		if (replayOf) {
			if (isValidObjectId(replayOf)) {
				const spaceChatExists = await SpaceChat.exists({ $and: [{ _id: replayOf }, { to: spaceId }] });
				replayOfOk = true;
				replayOf = spaceChatExists ? replayOf : undefined;
			} else {
				issue.replayOf = "Invalid replayOf id";
			}
		} else {
			replayOfOk = true;
		}

		if (textMessageOk && spaceIdOk && replayOfOk) {
			const files = req.files;
			if (files) {
				if (files.attachments) {
					const { filesUrl, errorMessage } = await multipleFilesCHeckAndUpload(files.attachments);
					if (!errorMessage) {
						attachmentsUrls = filesUrl;
						attachmentsOk = true;
					} else {
						issue.attachments = errorMessage;
					}
				} else {
					attachmentsOk = true;
				}
			} else {
				attachmentsOk = true;
			}

			if (attachmentsOk) {
				const SpaceChatStructure = new SpaceChat({
					sender: user._id,
					to: spaceId,
					replayOf,
					content: {
						text: textMessage,
						attachments: attachmentsUrls,
						mentionedUsers,
					},
				});

				const saveMessage = await SpaceChatStructure.save();

				const getTheMessage = await SpaceChat.findOne({ _id: saveMessage._id }).populate([
					{
						path: "sender",
						select: "fullName username avatar",
					},
					{
						path: "replayOf",
						select: "content editedAt createdAt",
						populate: [
							{
								path: "sender",
								select: "fullName username avatar",
							},
							{
								path: "content.mentionedUsers",
								select: "fullName username avatar",
							},
						],
					},
					{
						path: "content.mentionedUsers",
						select: "fullName username avatar",
					},
					{
						path: "seen",
						select: "fullName username avatar",
					},
					{
						path: "reactions.reactor",
						select: "fullName username avatar",
					},
				]);

				return res.status(201).json({ message: getTheMessage });
			}
		}

		return res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};

exports.getMessage = async (req, res, next) => {
	let { spaceId } = req.params;
	let { skip, limit } = req.query;
	try {
		limit = parseInt(limit) || 20;
		skip = parseInt(skip) || 0;
		const user = req.user;
		const issue = {};

		if (isValidObjectId(spaceId)) {
			const spaceExists = await Space.exists({ _id: spaceId });
			if (spaceExists) {
				const doIHaveAccessToSendMessage = await Space.exists({ $and: [{ _id: spaceId }, { "members.member": user._id }] });
				if (doIHaveAccessToSendMessage) {
					const getTheMessages = await SpaceChat.find({ $and: [{ to: spaceId }, { deleted: false }] })
						.sort({ createdAt: -1 })
						.populate([
							{
								path: "sender",
								select: "fullName username avatar",
							},
							{
								path: "replayOf",
								select: "content editedAt createdAt",
								populate: [
									{
										path: "sender",
										select: "fullName username avatar",
									},
									{
										path: "content.mentionedUsers",
										select: "fullName username avatar",
									},
								],
							},
							{
								path: "content.mentionedUsers",
								select: "fullName username avatar",
							},
							{
								path: "seen",
								select: "fullName username avatar",
							},
							{
								path: "reactions.reactor",
								select: "fullName username avatar",
							},
						])
						.skip(skip)
						.limit(limit);

					return res.json({ messages: getTheMessages });
				} else {
					issue.spaceId = "You are not a member of the space!!";
				}
			} else {
				issue.spaceId = "Not found space";
			}
		} else {
			issue.spaceId = "Invalid space id";
		}

		return res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};
