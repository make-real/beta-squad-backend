const { isValidObjectId } = require("mongoose");
const UserSession = require("../models/UserSession");
const { parseJWT } = require("../utils/jwt");

exports.userAuthorization = async (req, res, next) => {
	try {
		const issue = {};
		let token = req.socketAuthToken ? `Bearer ${req.socketAuthToken}` : req.headers.authorization;
		if (token) {
			token = token.split(" ")[1];
			const jwt_payload = parseJWT(token);

			if (!jwt_payload.error) {
				if (jwt_payload.sessionId && isValidObjectId(jwt_payload.sessionId)) {
					const loginSession = await UserSession.findOne({
						$and: [{ _id: jwt_payload.sessionId }, { sessionUUID: jwt_payload.sessionUUID }],
					}).populate({
						path: "user",
						select: "+emailVerified +phoneVerified",
					});

					if (loginSession) {
						const user = loginSession.user;
						if (user) {
							if (user.emailVerified) {
								req.user = user;
								return next();
							} else {
								issue.message = "Please verify your email address!";
							}
						} else {
							issue.message = "User doesn't exist!";
						}
					} else {
						issue.message = "Invalid token!";
					}
				} else {
					issue.message = "Invalid token";
				}
			} else {
				issue.message = jwt_payload.error;
			}
		} else {
			issue.message = "Please provide token in - headers.authorization";
		}

		if (req.socketAuthToken) {
			console.log(`Socket: ${issue.message}`);
			return next(new Error("invalid"));
		}
		return res.status(401).json({ issue });
	} catch (err) {
		next(err);
	}
};
