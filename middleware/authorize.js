const { isValidObjectId, Types } = require("mongoose");

const CommentChat = require("../models/CommentChat");
const Card = require("../models/Card");
const List = require("../models/List");
const SpaceFile = require("../models/SpaceFile");
const Space = require("../models/Space");
const Workspace = require("../models/Workspace");
const Subscription = require("../models/Subscription");

const subscriptionCheck = async (spaceId, workSpaceId) => {
	if (spaceId) {
		const space = await Space.findOne({ _id: spaceId }).select("workSpaceRef");
		workSpaceId = space.workSpaceRef;
	}

	const workspace = await Workspace.aggregate([
		{ $match: { _id: Types.ObjectId(workSpaceId) } },
		{ $unwind: "$teamMembers" }, // Unwind the array
		{ $match: { "teamMembers.role": "owner" } },
		{ $project: { _id: 0, teamMember: "$teamMembers" } },
	]);

	const subscription = await Subscription.findOne({ user: workspace[0].teamMember.member, expiredDate: { $gt: new Date() } })
		.select("type paid stop")
		.sort({ createdAt: 1 });

	if (!subscription && (!subscription.paid || subscription.stop)) {
		return { status: true, message: "OK" };
	} else {
		return { status: false, message: "Subscription required by the owner of the workspace!" };
	}
};

exports.contentPermission = (accessFor = []) => {
	return async (req, res, next) => {
		const user = req.user;
		const issue = {};
		let statusCode = 400;
		let { workspaceId, spaceId, spaceFileId, listId, cardId, commentId } = req.params;
		workspaceId = workspaceId || req.body.workspaceId;

		try {
			let member;
			if (commentId) {
				if (isValidObjectId(commentId)) {
					const comment = await CommentChat.findOne({ _id: commentId }).select("spaceRef");
					if (comment) {
						const result = await subscriptionCheck(comment.spaceRef);
						if (result.status) {
							const space = await Space.findOne({ _id: comment.spaceRef }).select("workSpaceRef");
							if (space) {
								const spaceAccess = await Space.aggregate([
									{ $match: { _id: Types.ObjectId(comment.spaceRef) } },
									{ $unwind: "$members" }, // Unwind the array
									{ $match: { "members.member": Types.ObjectId(user._id) } },
									{ $project: { _id: 0, member: "$members" } },
								]);

								const workspaceAccess = await Workspace.aggregate([
									{ $match: { _id: Types.ObjectId(space.workSpaceRef) } },
									{ $unwind: "$teamMembers" }, // Unwind the array
									{ $match: { "teamMembers.member": Types.ObjectId(user._id) } },
									{ $project: { _id: 0, teamMember: "$teamMembers" } },
								]);

								if (workspaceAccess.length) {
									member = {
										_id: workspaceAccess[0].teamMember.member,
										workspaceRole: workspaceAccess[0].teamMember.role,
										spaceRole: spaceAccess[0].member.role,
									};
								}
							} else {
								issue.message = "Something is wrong";
							}
						} else {
							issue.message = result.message;
						}
					} else {
						issue.commentId = "Comment does not exists with the Obj Id";
					}
				} else {
					issue.commentId = "Invalid comment Obj Id";
				}
			} else if (cardId) {
				if (isValidObjectId(cardId)) {
					const card = await Card.findOne({ _id: cardId }).select("spaceRef");
					if (card) {
						const result = await subscriptionCheck(card.spaceRef);
						if (result.status) {
							const space = await Space.findOne({ _id: card.spaceRef }).select("workSpaceRef");
							if (space) {
								const spaceAccess = await Space.aggregate([
									{ $match: { _id: Types.ObjectId(card.spaceRef) } },
									{ $unwind: "$members" }, // Unwind the array
									{ $match: { "members.member": Types.ObjectId(user._id) } },
									{ $project: { _id: 0, member: "$members" } },
								]);

								const workspaceAccess = await Workspace.aggregate([
									{ $match: { _id: Types.ObjectId(space.workSpaceRef) } },
									{ $unwind: "$teamMembers" }, // Unwind the array
									{ $match: { "teamMembers.member": Types.ObjectId(user._id) } },
									{ $project: { _id: 0, teamMember: "$teamMembers" } },
								]);

								if (workspaceAccess.length) {
									member = {
										_id: workspaceAccess[0].teamMember.member,
										workspaceRole: workspaceAccess[0].teamMember.role,
										spaceRole: spaceAccess[0].member.role,
									};
								}
							} else {
								issue.message = "Something is wrong";
							}
						} else {
							issue.message = result.message;
						}
					} else {
						issue.cardId = "Card does not exists with the Obj Id";
					}
				} else {
					issue.cardId = "Invalid card Obj Id";
				}
			} else if (listId) {
				if (isValidObjectId(listId)) {
					const list = await List.findOne({ _id: listId }).select("spaceRef");
					if (list) {
						const result = await subscriptionCheck(list.spaceRef);
						if (result.status) {
							const space = await Space.findOne({ _id: list.spaceRef }).select("workSpaceRef");
							if (space) {
								const spaceAccess = await Space.aggregate([
									{ $match: { _id: Types.ObjectId(list.spaceRef) } },
									{ $unwind: "$members" }, // Unwind the array
									{ $match: { "members.member": Types.ObjectId(user._id) } },
									{ $project: { _id: 0, member: "$members" } },
								]);

								const workspaceAccess = await Workspace.aggregate([
									{ $match: { _id: Types.ObjectId(space.workSpaceRef) } },
									{ $unwind: "$teamMembers" }, // Unwind the array
									{ $match: { "teamMembers.member": Types.ObjectId(user._id) } },
									{ $project: { _id: 0, teamMember: "$teamMembers" } },
								]);

								if (workspaceAccess.length) {
									member = {
										_id: workspaceAccess[0].teamMember.member,
										workspaceRole: workspaceAccess[0].teamMember.role,
										spaceRole: spaceAccess[0].member.role,
									};
								}
							} else {
								issue.message = "Something is wrong";
							}
						} else {
							issue.message = result.message;
						}
					} else {
						issue.listId = "List does not exists with the Obj Id";
					}
				} else {
					issue.listId = "Invalid list Obj Id";
				}
			} else if (spaceFileId) {
				if (isValidObjectId(spaceFileId)) {
					const spaceFile = await SpaceFile.findOne({ _id: spaceFileId }).select("spaceRef");
					if (spaceFile) {
						const result = await subscriptionCheck(spaceFile.spaceRef);
						if (result.status) {
							const space = await Space.findOne({ _id: spaceFile.spaceRef }).select("workSpaceRef");
							if (space) {
								const spaceAccess = await Space.aggregate([
									{ $match: { _id: Types.ObjectId(spaceFile.spaceRef) } },
									{ $unwind: "$members" }, // Unwind the array
									{ $match: { "members.member": Types.ObjectId(user._id) } },
									{ $project: { _id: 0, member: "$members" } },
								]);

								const workspaceAccess = await Workspace.aggregate([
									{ $match: { _id: Types.ObjectId(space.workSpaceRef) } },
									{ $unwind: "$teamMembers" }, // Unwind the array
									{ $match: { "teamMembers.member": Types.ObjectId(user._id) } },
									{ $project: { _id: 0, teamMember: "$teamMembers" } },
								]);

								if (workspaceAccess.length) {
									member = {
										_id: workspaceAccess[0].teamMember.member,
										workspaceRole: workspaceAccess[0].teamMember.role,
										spaceRole: spaceAccess[0].member.role,
									};
								}
							} else {
								issue.message = "Something is wrong";
							}
						} else {
							issue.message = result.message;
						}
					} else {
						issue.spaceFileId = "Space File does not exists with the Obj Id";
					}
				} else {
					issue.spaceFileId = "Invalid space File Obj Id";
				}
			} else if (spaceId) {
				if (isValidObjectId(spaceId)) {
					const space = await Space.findOne({ _id: spaceId }).select("workSpaceRef");

					const result = await subscriptionCheck(spaceId);
					if (result.status) {
						if (space) {
							const spaceAccess = await Space.aggregate([
								{ $match: { _id: Types.ObjectId(spaceId) } },
								{ $unwind: "$members" }, // Unwind the array
								{ $match: { "members.member": Types.ObjectId(user._id) } },
								{ $project: { _id: 0, member: "$members" } },
							]);

							const workspaceAccess = await Workspace.aggregate([
								{ $match: { _id: Types.ObjectId(space.workSpaceRef) } },
								{ $unwind: "$teamMembers" }, // Unwind the array
								{ $match: { "teamMembers.member": Types.ObjectId(user._id) } },
								{ $project: { _id: 0, teamMember: "$teamMembers" } },
							]);

							if (workspaceAccess.length) {
								member = {
									_id: workspaceAccess[0].teamMember.member,
									workspaceRole: workspaceAccess[0].teamMember.role,
									spaceRole: spaceAccess[0].member.role,
								};
							}
						} else {
							issue.message = "Something is wrong";
						}
					} else {
						issue.message = result.message;
					}
				} else {
					issue.spaceId = "Invalid space Obj Id";
				}
			} else if (workspaceId) {
				if (isValidObjectId(workspaceId)) {
					const result = await subscriptionCheck(undefined, workspaceId);
					if (result.status) {
						const workspace = await Workspace.findOne({ _id: workspaceId }).select("_id");
						if (workspace) {
							const workspaceAccess = await Workspace.aggregate([
								{ $match: { _id: Types.ObjectId(workspace._id) } },
								{ $unwind: "$teamMembers" }, // Unwind the array
								{ $match: { "teamMembers.member": Types.ObjectId(user._id) } },
								{ $project: { _id: 0, teamMember: "$teamMembers" } },
							]);

							if (workspaceAccess.length) {
								member = {
									_id: workspaceAccess[0].teamMember.member,
									workspaceRole: workspaceAccess[0].teamMember.role,
								};
							}
						} else {
							issue.workspaceId = "Workspace does not exists with the Obj Id";
						}
					} else {
						issue.message = result.message;
					}
				} else {
					issue.workspaceId = "Invalid space Obj Id";
				}
			}

			if (member && (accessFor.includes(member.workspaceRole) || accessFor.includes(member.spaceRole))) {
				next();
				return;
			} else {
				if (!Object.keys(issue).length) {
					statusCode = 403;
					issue.message = "Permission denied!";
				}
			}

			res.status(statusCode).json({ issue });
		} catch (err) {
			next(err);
		}
	};
};
