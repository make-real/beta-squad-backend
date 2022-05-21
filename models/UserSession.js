const { Schema, model } = require("mongoose");

const userSessionSchema = new Schema(
	{
		user: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: "User",
		},
		sessionName: {
			type: String,
			default: "UserLoginSession",
		},
		sessionUUID: {
			type: String,
			required: true,
		},
		verified: {
			type: Boolean,
			default: false,
		},
		expireDate: {
			type: Date,
			required: true,
		},
	},
	{
		timestamps: true,
	}
);

const UserSession = model("UserSession", userSessionSchema);

module.exports = UserSession;
