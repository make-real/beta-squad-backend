const { isValidObjectId } = require("mongoose");
const Space = require("../../../models/Space");
const SpaceChat = require("../../../models/SpaceChat");
const { splitSpecificParts } = require("../../../utils/func");
const { multipleFilesCheckAndUpload, upload } = require("../../../utils/file");
const User = require("../../../models/User");

exports.sendMessage = async (req, res, next) => {
	let { textMessage, replayOf } = req.body;
	let mentionedUsers = [],
		attachmentsUrls = [],
		voiceUrl;
	let { spaceId } = req.params;
	try {
		const user = req.user;
		const issue = {};

		let textMessageOk, attachmentsOk, voiceOk, spaceIdOk, replayOfOk;

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
			if (ids.length > 0) {
				const validMentionedUsers = await User.find({ _id: { $in: ids } }).select("_id");
				for (const user of validMentionedUsers) {
					mentionedUsers.push(user._id);
				}
			}
			textMessageOk = true;
		} else {
			textMessageOk = true;
		}

		// spaceId check
		const isValidSpaceId = isValidObjectId(spaceId);
		if (isValidSpaceId) {
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
			if (isValidSpaceId) {
				if (isValidObjectId(replayOf)) {
					const spaceChatExists = await SpaceChat.exists({ $and: [{ _id: replayOf }, { to: spaceId }] });
					replayOfOk = true;
					replayOf = spaceChatExists ? replayOf : undefined;
				} else {
					issue.replayOf = "Invalid replayOf id";
				}
			}
		} else {
			replayOfOk = true;
		}

		if (textMessageOk && spaceIdOk && replayOfOk) {
			const files = req.files;
			if (files) {
				if (files.attachments) {
					const { filesUrl, errorMessage } = await multipleFilesCheckAndUpload(files.attachments);
					if (!errorMessage) {
						attachmentsUrls = filesUrl;
						attachmentsOk = true;
					} else {
						issue.attachments = errorMessage;
					}
				} else {
					attachmentsOk = true;
				}

				if (files.voice) {
					if (files.voice.path) {
						const uploadResult = await upload(files.voice.path);
						if (uploadResult.secure_url) {
							voiceUrl = uploadResult.secure_url;
							voiceOk = true;
						} else {
							issue.voice = uploadResult.message;
						}
					} else {
						issue.voice = "Something went wrong with the voice file.";
					}
				} else {
					voiceOk = true;
				}
			} else {
				attachmentsOk = true;
				voiceOk = true;
			}

			if (attachmentsOk && voiceOk) {
				const SpaceChatStructure = new SpaceChat({
					sender: user._id,
					to: spaceId,
					replayOf,
					content: {
						text: textMessage,
						attachments: attachmentsUrls,
						voice: voiceUrl,
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

				global.io.to(String(spaceId)).emit("NEW_SPACE_MESSAGE_RECEIVED", getTheMessage);

				res.status(201).json({ message: getTheMessage });

				// Operation for unseen message update as seen
				SpaceChat.updateMany(
					{
						$and: [
							{ to: spaceId },
							{
								$nor: [{ sender: user._id }, { seen: user._id }],
							},
						],
					},
					{ $push: { seen: user._id } }
				).then();
				// Operation End
			}
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

exports.getMessages = async (req, res, next) => {
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
				const doIHaveAccess = await Space.exists({ $and: [{ _id: spaceId }, { "members.member": user._id }] });
				if (doIHaveAccess) {
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

					res.json({ messages: getTheMessages });

					// Operation for unseen message update as seen
					SpaceChat.updateMany(
						{
							$and: [
								{ to: spaceId },
								{
									$nor: [{ sender: user._id }, { seen: user._id }],
								},
							],
						},
						{ $push: { seen: user._id } }
					).then();
					// Operation End
				} else {
					issue.spaceId = "You are not a member of the space!!";
				}
			} else {
				issue.spaceId = "Not found space";
			}
		} else {
			issue.spaceId = "Invalid space id";
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

exports.memberListToMention = async (req, res, next) => {
	let { spaceId } = req.params;
	let { skip, limit, search } = req.query;
	try {
		limit = parseInt(limit) || 100;
		skip = parseInt(skip) || 0;
		const user = req.user;
		const issue = {};

		if (isValidObjectId(spaceId)) {
			const spaceExists = await Space.exists({ _id: spaceId });
			if (spaceExists) {
				const doIHaveAccess = await Space.exists({ $and: [{ _id: spaceId }, { "members.member": user._id }] });
				if (doIHaveAccess) {
					let searchQuery = {};
					if (search) {
						function es(str) {
							return str.replace(/[-\/\\^$*+?()|[\]{}]/g, "");
						}
						const KeyWordRegExp = new RegExp(".*" + es(search) + ".*", "i"); // Match any word of the name
						searchQuery = { $or: [{ fullName: KeyWordRegExp }, { username: KeyWordRegExp }, { email: KeyWordRegExp }] };
					}

					const getMemberOfSpace = await Space.findOne({ _id: spaceId })
						.select("+members -name -description -privacy -color -workSpaceRef")
						.populate({
							path: "members",
							populate: {
								path: "member",
								select: "_id",
							},
						});

					const spaceMembers = getMemberOfSpace.members;
					const membersId = [];
					for (const single of spaceMembers) {
						console.log(single);
						if (single.member) {
							const member = single.member;
							membersId.push(member._id);
						}
					}

					const members = await User.find({ $and: [{ _id: { $in: membersId } }, searchQuery] })
						.select("fullName username avatar")
						.skip(skip)
						.limit(limit);

					return res.json({ users: members });
				} else {
					issue.spaceId = "You are not a member of the space!!";
				}
			} else {
				issue.spaceId = "Not found space!";
			}
		} else {
			issue.spaceId = "Invalid space id";
		}

		return res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};

exports.messageEdit = async (req, res, next) => {
	let { spaceId, messageId } = req.params;
	let { updateMessage } = req.body;
	let mentionedUsers = [];

	try {
		const user = req.user;
		const issue = {};

		let idOk, updateMessageOk;

		const isValidSpaceId = isValidObjectId(spaceId);
		const isValidMessageId = isValidObjectId(messageId);
		if (isValidSpaceId && isValidMessageId) {
			const messageExists = await SpaceChat.findOne({ _id: messageId }).select("to");
			if (messageExists) {
				const doAccessToEdit = await Space.exists({ $and: [{ _id: messageExists.to }, { "members.member": user._id }] });
				const doAccessToEdit1 = await SpaceChat.exists({ $and: [{ _id: messageId }, { sender: user._id }] });
				if (doAccessToEdit && doAccessToEdit1) {
					const isDeleted = await SpaceChat.exists({ $and: [{ _id: messageId }, { deleted: true }] });
					if (!isDeleted) {
						idOk = true;
					} else {
						issue.message = "The message is currently deleted!";
					}
				} else {
					issue.message = "Unable to perform the operation!";
				}
			} else {
				issue.message = "Not found message!";
			}
		} else {
			if (!isValidSpaceId) {
				issue.message = "Invalid space id";
			} else if (!isValidMessageId) {
				issue.message = "Invalid message id";
			}
		}

		if (idOk) {
			// text message check
			if (updateMessage) {
				updateMessage = String(updateMessage).replace(/  +/g, " ").trim();
				const splitIds = splitSpecificParts(updateMessage, "{{", "}}");
				const ids = [];
				for (const id of splitIds) {
					if (isValidObjectId(id)) {
						ids.push(id);
					}
				}
				if (ids.length > 0) {
					const validMentionedUsers = await User.find({ _id: { $in: ids } }).select("_id");
					for (const user of validMentionedUsers) {
						mentionedUsers.push(user._id);
					}
				}
				updateMessageOk = true;
			} else {
				issue.message = "Please provide your updated message!";
			}
		}

		if (updateMessageOk) {
			const messageUpdate = await SpaceChat.updateOne(
				{ _id: messageId },
				{
					"content.text": updateMessage,
					"content.mentionedUsers": mentionedUsers,
					editedAt: Date.now(),
				}
			);

			if (messageUpdate.modifiedCount) {
				const getEditedMessage = await SpaceChat.findOne({ _id: messageId }).populate([
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
				return res.json({ editedMessage: getEditedMessage });
			} else {
				issue.message = "Failed to edit!";
			}
		}

		return res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};

exports.messageDelete = async (req, res, next) => {
	let { spaceId, messageId } = req.params;

	try {
		const user = req.user;
		const issue = {};

		let idOk;

		const isValidSpaceId = isValidObjectId(spaceId);
		const isValidMessageId = isValidObjectId(messageId);
		if (isValidSpaceId && isValidMessageId) {
			const messageExists = await SpaceChat.findOne({ _id: messageId }).select("to");
			if (messageExists) {
				spaceId = messageExists.to;
				const doAccessToDelete = await Space.exists({ $and: [{ _id: messageExists.to }, { "members.member": user._id }] });
				const doAccessToDelete1 = await SpaceChat.exists({ $and: [{ _id: messageId }, { sender: user._id }] });
				if (doAccessToDelete && doAccessToDelete1) {
					const isDeleted = await SpaceChat.exists({ $and: [{ _id: messageId }, { deleted: true }] });
					if (!isDeleted) {
						idOk = true;
					} else {
						issue.message = "The message is already deleted!";
					}
				} else {
					issue.message = "Unable to perform the operation!";
				}
			} else {
				issue.message = "Not found message!";
			}
		} else {
			if (!isValidSpaceId) {
				issue.message = "Invalid space id";
			} else if (!isValidMessageId) {
				issue.message = "Invalid message id";
			}
		}

		if (idOk) {
			const deleteMessage = await SpaceChat.updateOne(
				{ _id: messageId },
				{
					deleted: true,
				}
			);

			if (deleteMessage.modifiedCount) {
				res.json({ message: "Successfully deleted the message!" });

				// message deleted event Emitting realtime to the users
				const space = await Space.findOne({ _id: spaceId }).select("members.member");
				if (space) {
					const memberIds = [];
					for (const item of space.members) {
						memberIds.push(item.member);
					}
					const socketIds = await User.find({ $and: [{ _id: { $in: memberIds } }, { socketId: { $ne: null } }] })
						.select("socketId")
						.distinct("socketId");

					const data = {
						spaceId,
						messageId,
					};
					for (const socketId of socketIds) {
						global.io.to(socketId).emit("ON_MESSAGE_REMOVED", data);
					}
				}
			} else {
				issue.message = "Failed to delete!";
			}
		}

		if (!res.headersSent) {
			return res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

exports.messageReaction = async (req, res, next) => {
	let { spaceId, messageId } = req.params;
	let { reaction } = req.body;

	try {
		const user = req.user;
		const issue = {};

		let idOk, reactionOk;

		const isValidSpaceId = isValidObjectId(spaceId);
		const isValidMessageId = isValidObjectId(messageId);
		if (isValidSpaceId && isValidMessageId) {
			const messageExists = await SpaceChat.findOne({ _id: messageId }).select("to");
			if (messageExists) {
				spaceId = messageExists.to;
				const doAccessToReaction = await Space.exists({ $and: [{ _id: messageExists.to }, { "members.member": user._id }] });
				if (doAccessToReaction) {
					const isDeleted = await SpaceChat.exists({ $and: [{ _id: messageId }, { deleted: true }] });
					if (!isDeleted) {
						idOk = true;
					} else {
						issue.message = "The message is currently deleted!";
					}
				} else {
					issue.message = "Unable to perform the operation!";
				}
			} else {
				issue.message = "Not found message!";
			}
		} else {
			if (!isValidSpaceId) {
				issue.message = "Invalid space id";
			} else if (!isValidMessageId) {
				issue.message = "Invalid message id";
			}
		}

		if (idOk) {
			// check the reaction
			if (reaction) {
				reaction = String(reaction).replace(/  +/g, "").trim();
				reactionOk = true;
			} else {
				issue.message = "Please provide your reaction!";
			}
		}

		if (reactionOk) {
			const isAlreadyReacted = await SpaceChat.exists({
				$and: [
					{ _id: messageId },
					{
						reactions: {
							$elemMatch: { reactor: user._id },
						},
					},
				],
			});

			let updateReaction;
			if (isAlreadyReacted) {
				// Update reaction
				updateReaction = await SpaceChat.updateOne(
					{
						$and: [{ _id: messageId }, { "reactions.reactor": user._id }],
					},
					{ $set: { "reactions.$.reaction": reaction } }
				);
			} else {
				// Push reaction
				updateReaction = await SpaceChat.updateOne(
					{ _id: messageId },
					{
						$push: {
							reactions: {
								reactor: user._id,
								reaction,
							},
						},
					}
				);
			}

			if (updateReaction.modifiedCount) {
				const getReactions = await SpaceChat.findOne({ _id: messageId }).select("reactions").populate({
					path: "reactions.reactor",
					select: "fullName username avatar",
				});
				res.json({ reactions: getReactions.reactions });

				// reaction Emitting/Sending realtime to the users
				const space = await Space.findOne({ _id: spaceId }).select("members.member");
				if (space) {
					const memberIds = [];
					for (const item of space.members) {
						memberIds.push(item.member);
					}
					const socketIds = await User.find({ $and: [{ _id: { $in: memberIds } }, { socketId: { $ne: null } }] })
						.select("socketId")
						.distinct("socketId");

					const data = {
						spaceId,
						messageId,
						react: {
							reactor: {
								_id: user._id,
								fullName: user.fullName,
								username: user.username,
							},
							reaction,
						},
					};
					for (const socketId of socketIds) {
						global.io.to(socketId).emit("NEW_REACTION_RECEIVED", data);
					}
				}
			} else {
				issue.message = "Failed to react!";
			}
		}

		if (!res.headersSent) {
			return res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};
