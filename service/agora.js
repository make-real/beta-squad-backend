const { RtcTokenBuilder, RtcRole } = require("agora-access-token");
// const Agora = require("../models/Agora");

exports.generateToken = async (channel, uid) => {
	try {
		const expirationTimeInSeconds = 21600;
		const role = RtcRole.PUBLISHER;
		const currentTimestamp = Math.floor(Date.now() / 1000);
		const expirationTimestamp = currentTimestamp + expirationTimeInSeconds;

		// const agora = await Agora.findOne({ active: true });

		const token = RtcTokenBuilder.buildTokenWithUid("d650cc9984014529827ee1a4bcb345fc", "9135c44f84054836a6bdad3c17ff1e2a", channel, uid, role, expirationTimestamp);

		return token;
	} catch (error) {
		console.log(error);

		return null;
	}
};
