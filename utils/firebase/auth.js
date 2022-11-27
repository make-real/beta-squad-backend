const firebase = require("./index");

exports.verifyGoogleToken = async (IdToken) => {
	try {
		const data = await firebase.auth().verifyIdToken(IdToken);
		return {
			fullName: data?.name,
			email: data?.email,
			picture: data?.picture,
		};
	} catch (error) {
		return { error: error.message };
	}
};
