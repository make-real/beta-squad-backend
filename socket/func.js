const Workspace = require("../models/Workspace");
const User = require("../models/User");
const { Types } = require("mongoose");

const onlineOfflineSignalEmit = async (eventName, userId) => {
	const user = await User.findOne({ _id: userId }).select("fullName username email");
	const workspaces = await Workspace.aggregate([
		{ $match: { "teamMembers.member": Types.ObjectId(userId) } },
		{
			$lookup: {
				from: "users",
				localField: "teamMembers.member",
				foreignField: "_id",
				as: "teamMembers",
				pipeline: [{ $match: { socketId: { $ne: null } } }, { $project: { socketId: 1 } }],
			},
		},
		{ $project: { teamMembers: 1 } },
	]);

	const socketIds = [];
	for (const workspace of workspaces) {
		for (const teamMember of workspace.teamMembers) {
			socketIds.push(teamMember.socketId);
		}
	}

	for (const socketId of socketIds) {
		const data = user;
		io.to(socketId).emit(eventName, data);
	}
};

module.exports = { onlineOfflineSignalEmit };
