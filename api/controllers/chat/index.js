const { isValidObjectId } = require("mongoose");
const ChatHeader = require("../../../models/ChatHeader");
const Chat = require("../../../models/Chat");
const { splitSpecificParts } = require("../../../utils/func");
const { multipleFilesCheckAndUpload, upload } = require("../../../utils/file");
const User = require("../../../models/User");
const Workspace = require("../../../models/Workspace");

exports.sendMessage = async (req, res, next) => {
	const { workspaceId } = req.params;
	let { sendTo, textMessage, replayOf } = req.body;

	let mentionedUsers = [],
		attachmentsUrls = [],
		voiceUrl;
	try {
		const user = req.user;
		const issue = {};

		let workspaceIdOk, sendToOk, textMessageOk, replayOfOk, attachmentsOk, voiceOk;

		// workspaceId check
		if (workspaceId) {
			var isValidWorkspaceId = isValidObjectId(workspaceId);
			if (isValidWorkspaceId) {
				var workspaceExists = await Workspace.exists({ _id: workspaceId });
				if (workspaceExists) {
					const amIExistsItThisWorkspace = await Workspace.exists({ $and: [{ _id: workspaceId }, { "teamMembers.member": user._id }] });
					if (amIExistsItThisWorkspace) {
						workspaceIdOk = true;
					} else {
						issue.workspaceId = "You have no access in this workspace!";
					}
				} else {
					issue.workspaceId = "Workspace not found!";
				}
			} else {
				issue.workspaceId = "Invalid workspace Id!";
			}
		} else {
			issue.workspaceId = "Please provide workspace Id!";
		}

		// sendTo check
		if (sendTo) {
			if (isValidObjectId(sendTo)) {
				var participantExists = await User.findOne({ _id: sendTo }).select("fullName username email socketId");
				if (participantExists) {
					if (workspaceExists) {
						const participantExistsInWorkspace = await Workspace.exists({ $and: [{ _id: workspaceId }, { "teamMembers.member": sendTo }] });
						if (participantExistsInWorkspace) {
							sendToOk = true;
						} else {
							issue.workspaceId = "Participant has no access in this workspace!";
						}
					}
				} else {
					issue.sendTo = "Participant doesn't exists!";
				}
			} else {
				issue.sendTo = "Invalid mongo Id";
			}
		} else {
			issue.sendTo = "Please provide user Id where you want to send!";
		}

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

		if (workspaceIdOk && sendToOk) {
			var chatHeader = await ChatHeader.findOne({ $and: [{ workSpaceRef: workspaceId }, { "participants.user": user._id }, { "participants.user": sendTo }] });
		}

		// replayOf id check
		if (replayOf) {
			if (workspaceIdOk && sendToOk) {
				if (isValidObjectId(replayOf)) {
					const chatExists = await Chat.exists({ $and: [{ _id: replayOf }, { chatHeaderRef: chatHeader._id }] });
					replayOfOk = true;
					replayOf = chatExists ? replayOf : undefined;
				} else {
					issue.replayOf = "Invalid replayOf id";
				}
			}
		} else {
			replayOfOk = true;
		}

		if (textMessageOk && sendToOk && workspaceIdOk && replayOfOk) {
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
				if (!chatHeader) {
					const chatHeaderStructure = new ChatHeader({
						participants: [
							{
								user: user._id,
							},

							{
								user: sendTo,
							},
						],
						workSpaceRef: workspaceId,
					});
					chatHeader = await chatHeaderStructure.save();
				}

				const ChatStructure = new Chat({
					sender: user._id,
					to: sendTo,
					chatHeaderRef: chatHeader._id,
					replayOf,
					content: {
						text: textMessage,
						attachments: attachmentsUrls,
						voice: voiceUrl,
						mentionedUsers,
					},
				});

				const saveMessage = await ChatStructure.save();

				const getTheMessage = await Chat.findOne({ _id: saveMessage._id }).populate([
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

				global.io.to(String(participantExists.socketId)).to(String(user.socketId)).emit("NEW_CHAT_MESSAGE_RECEIVED", getTheMessage);

				res.status(201).json({ message: getTheMessage });

				// update ChatHeader
				await ChatHeader.updateOne(
					{ _id: chatHeader._id },
					{
						lastMessageTime: new Date(),
						searchTags: [
							{ id: user._id, tags: [user.fullName, user.username, user.email].filter(Boolean) },
							{ id: participantExists._id, tags: [participantExists.fullName, participantExists.username, participantExists.email].filter(Boolean) },
						],
					}
				);

				// Operation for unseen message update as seen
				Chat.updateMany(
					{
						$and: [
							{
								$nor: [{ sender: user._id }, { seen: user._id }],
							},
							{ chatHeaderRef: chatHeader._id },
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
	const { workspaceId } = req.params;
	let { skip, limit, participant } = req.query;

	try {
		const user = req.user;
		const issue = {};

		let workspaceIdOk, participantToOk;

		// workspaceId check
		if (workspaceId) {
			var isValidWorkspaceId = isValidObjectId(workspaceId);
			if (isValidWorkspaceId) {
				var workspaceExists = await Workspace.exists({ _id: workspaceId });
				if (workspaceExists) {
					const amIExistsItThisWorkspace = await Workspace.exists({ $and: [{ _id: workspaceId }, { "teamMembers.member": user._id }] });
					if (amIExistsItThisWorkspace) {
						workspaceIdOk = true;
					} else {
						issue.workspaceId = "You have no access in this workspace!";
					}
				} else {
					issue.workspaceId = "Workspace not found!";
				}
			} else {
				issue.workspaceId = "Invalid workspace Id!";
			}
		} else {
			issue.workspaceId = "Please provide workspace Id!";
		}

		// participant check
		if (participant) {
			if (isValidObjectId(participant)) {
				var participantExists = await User.findOne({ _id: participant }).select("socketId");
				if (participantExists) {
					if (workspaceExists) {
						const participantExistsInWorkspace = await Workspace.exists({ $and: [{ _id: workspaceId }, { "teamMembers.member": participant }] });
						if (participantExistsInWorkspace) {
							participantToOk = true;
						} else {
							issue.workspaceId = "Participant has no access in this workspace!";
						}
					}
				} else {
					issue.participant = "Participant doesn't exists!";
				}
			} else {
				issue.participant = "Invalid mongo Id";
			}
		} else {
			issue.participant = "Please provide user Id where you want to send!";
		}

		if (participantToOk && workspaceIdOk) {
			const chatHeader = await ChatHeader.findOne({ $and: [{ workSpaceRef: workspaceId }, { "participants.user": user._id }, { "participants.user": participant }] });

			let messages = [];
			if (chatHeader) {
				const getMessages = await Chat.find({
					$and: [
						{ chatHeaderRef: chatHeader._id },
						{
							$or: [{ $and: [{ sender: user._id }, { to: participant }] }, { $and: [{ sender: participant }, { to: user._id }] }],
						},
					],
				})
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
					.sort({ createdAt: -1 })
					.skip(skip)
					.limit(limit);

				messages = getMessages;
				// Operation for unseen message update as seen
				Chat.updateMany(
					{
						$and: [
							{
								$nor: [{ sender: user._id }, { seen: user._id }],
							},
							{ chatHeaderRef: chatHeader._id },
						],
					},
					{ $push: { seen: user._id } }
				).then();
				// Operation End
			}

			res.json({ messages });
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

exports.getChatList = async (req, res, next) => {
	const { workspaceId } = req.params;
	let { skip, limit, search } = req.query;
	try {
		limit = parseInt(limit) || 20;
		skip = parseInt(skip) || 0;
		const user = req.user;
		const issue = {};

		if (workspaceId) {
			if (isValidObjectId(workspaceId)) {
				const existsWorkspace = await Workspace.exists({ _id: workspaceId });
				if (existsWorkspace) {
					const doIHaveAccessToGetTag = await Workspace.exists({
						$and: [
							{ _id: workspaceId },
							{
								"teamMembers.member": user._id,
							},
						],
					});

					if (doIHaveAccessToGetTag) {
						let searchQuery = {};
						if (search) {
							const KeyWordRegExp = new RegExp(".*" + search.replace(/[-\/\\^$*+?()|[\]{}]/g, "") + ".*", "i");
							searchQuery = {
								searchTags: {
									$elemMatch: {
										id: { $ne: user._id },
										tags: KeyWordRegExp,
									},
								},
							};
						}

						const chatHeaders = await ChatHeader.find({ $and: [{ workSpaceRef: workspaceId }, { "participants.user": user._id }, searchQuery] })
							.populate({
								path: "participants.user",
								select: "fullName username avatar lastOnline",
							})
							.sort({ lastMessageTime: -1 })
							.skip(skip)
							.limit(limit);

						const chatLists = [];
						for (const chatHeader of chatHeaders) {
							let participant;
							if (String(chatHeader?.participants[0]?.user?._id) === String(user._id)) {
								participant = chatHeader?.participants[1]?.user;
							} else if (String(chatHeader?.participants[1]?.user?._id) === String(user._id)) {
								participant = chatHeader?.participants[0]?.user;
							}
							chatLists.push({
								_id: chatHeader._id,
								participant,
								workSpaceRef: chatHeader.workSpaceRef,
								createdAt: chatHeader.createdAt,
								updatedAt: chatHeader.updatedAt,
							});
						}

						return res.json({ chatLists });
					} else {
						issue.message = "You are not a team member of the workplace!";
					}
				} else {
					issue.workspaceId = "Not found workspace";
				}
			} else {
				issue.workspaceId = "Please provide workspace mongoose object ID";
			}
		} else {
			issue.workspaceId = "Please provide workspace Id";
		}

		res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};
