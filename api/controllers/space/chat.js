const { isValidObjectId } = require("mongoose");
const Space = require("../../../models/Space");
const SpaceChat = require("../../../models/SpaceChat");
const { splitSpecificParts } = require("../../../utils/func");
const { multipleFilesCHeckAndUpload } = require("../../../utils/file");

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
			textMessageOk = true;
			mentionedUsers = splitSpecificParts(textMessage, "{{", "}}");
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
