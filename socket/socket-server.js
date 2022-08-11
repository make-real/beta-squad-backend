const { userAuthorization } = require("../middleware/authorization");
const Space = require("../models/Space");
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
			socket.join(ids);
			return next();
		} catch (error) {
			return next(error);
		}
	});

	io.on("connection", async (socket) => {
		// You can do something like emitting an event hare.
		console.log(`Connected an user through socket:`);

		socket.on("disconnect", async () => {
			const user = socket.request.user;
			const userId = user._id;
			const getSpaces = await Space.find({ "members.member": userId }).select("_id").distinct("_id");
			const ids = [];
			for (const id of getSpaces) {
				ids.push(String(id));
			}
			socket.leave(ids);

			user.socketId = null;
			await user.save();
		});
	});
};

module.exports = socketServer;
