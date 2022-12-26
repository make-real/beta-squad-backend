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
			enum: ["UserLoginSession", "email-verification", "password-recover"],
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
		code: Number,
		codeMatched: Boolean,
		wrongCodeTry: {
			type: Number,
			default: function () {
				if (this.sessionName != "UserLoginSession") {
					return 0;
				}
			},
		},
	},
	{
		timestamps: true,
	}
);

const UserSession = model("UserSession", userSessionSchema);

module.exports = UserSession;
