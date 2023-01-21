const { userAuthorization } = require("../middleware/authorization");
const Call = require("../models/Call");
const Space = require("../models/Space");
const { generateToken } = require("../service/agora");

const socketServer = async () => {
	// Connection authorization
	io.use((socket, next) => {
		const req = socket.request;
		req.socketAuthToken = socket.handshake.auth.socketAuthToken;
		userAuthorization(req, {}, next);
	});

	// update user socket id
	io.use(async (socket, next) => {
		try {
			const user = socket.request.user;
			user.socketId = socket.id;
			await user.save();
			return next();
		} catch (error) {
			return next(error);
		}
	});

	io.use(async (socket, next) => {
		try {
			const user = socket.request.user;
			const userId = user._id;
			const getSpaces = await Space.find({ "members.member": userId }).select("_id").distinct("_id");
			const ids = [];
			for (const id of getSpaces) {
				ids.push(String(id));
			}
			ids.push(String(user._id));
			socket.join(ids);
			return next();
		} catch (error) {
			return next(error);
		}
	});

	io.on("connection", async (socket) => {
		const user = socket.request.user;

		// You can do something like emitting an event hare.
		console.log(`Connected an user through socket:`);

		socket.onAny((event, ...args) => {
			console.log({ event, args });
		});

		socket.on("START_CALL", async (spaceID, private, type) => {
			try {
				const channelId = `channel_${Date.now()}`;
				const call = await Call.create({
					space: spaceID,
					type,
					target: private ? "User" : "Space",
					channelId,
					callerId: user._id,
					participants: [
						{
							mic_muted: false,
							camera_off: true,
							user: user._id,
						},
					],
				});

				socket.join(String(call._id));

				await call.populate(["participants.user", "space"]);

				const token = await generateToken(channelId, user.uid);
				socket.emit("ON_JOIN_CALL", call, token);
				io.to(spaceID).emit("ON_CALL", call);

				if (private) socket.emit("ON_CALL", call);
			} catch (error) {
				console.log(error.message);
			}
		});

		socket.on("JOIN_CALL", async (callID) => {
			try {
				const call = await Call.findById(callID);

				socket.join(String(callID));

				call.participants.push({
					mic_muted: false,
					camera_off: true,
					user: user._id,
				});

				await call.save();

				await call.populate(["participants.user", "space"]);

				io.to(String(call._id)).emit("ON_CALL_UPDATED", call);

				const token = await generateToken(call?.channelId, user.uid);
				socket.emit("ON_JOIN_CALL", call, token);
			} catch (error) {
				console.log(error);
			}
		});

		socket.on("CAMERA_STATE_CHANGED", async (callID, state) => {
			try {
				await Call.updateOne(
					{ $and: [{ _id: callID }, { "participants.user": user._id }] },
					{
						$set: {
							"participants.$.camera_off": state,
						},
					}
				);

				const call = await Call.findById(callID).populate(["participants.user", "space"]);

				io.to(String(call._id)).emit("ON_CALL_UPDATED", call);
			} catch (error) {
				console.log(callID);
			}
		});

		socket.on("MIC_STATE_CHANGED", async (callID, state) => {
			try {
				await Call.updateOne(
					{ $and: [{ _id: callID }, { "participants.user": user._id }] },
					{
						$set: {
							"participants.$.mic_muted": state,
						},
					}
				);

				const call = await Call.findById(callID).populate(["participants.user", "space"]);

				io.to(String(call._id)).emit("ON_CALL_UPDATED", call);
			} catch (error) {
				console.log(callID);
			}
		});

		socket.on("END_CALL", async (callId) => {
			try {
				socket.leave(String(callId));

				await Call.updateOne(
					{ $and: [{ _id: callId }, { "participants.user": user._id }] },
					{
						$pull: {
							participants: {
								user: user._id,
							},
						},
					}
				);

				const call = await Call.findById(callId).populate(["participants.user", "space"]);

				io.to(String(call._id)).emit("ON_CALL_UPDATED", call);

				if (call?.target === "User") {
					io.to(String(call?.callerId)).emit("ON_CALL_END", call);
					io.to(String(call?.space)).emit("ON_CALL_END", call);
				}

				if (String(call.callerId) === String(user._id)) io.to(String(call?.space)).emit("ON_CALL_END", call);
			} catch (error) {
				console.log(error);
			}
		});

		socket.on("disconnect", async () => {
			try {
				const userId = user._id;
				const getSpaces = await Space.find({ "members.member": userId }).select("_id").distinct("_id");
				const ids = [];
				for (const id of getSpaces) {
					ids.push(String(id));
				}
				ids.push(String(user._id));

				socket.leave(ids);

				user.socketId = null;
				user.lastOnline = new Date();
				await user.save();
			} catch (error) {
				console.log(error);
			}
		});
	});
};

module.exports = socketServer;
