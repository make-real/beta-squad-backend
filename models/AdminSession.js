const { Schema, model } = require("mongoose");

const adminSessionSchema = new Schema(
	{
		admin: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: "Admin",
		},
		sessionName: {
			type: String,
			default: "AdminLoginSession",
			enum: ["AdminLoginSession", "email-verification", "password-recover"],
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
				if (this.sessionName != "AdminLoginSession") {
					return 0;
				}
			},
		},
	},
	{
		timestamps: true,
	}
);

const AdminSession = model("AdminSession", adminSessionSchema);

module.exports = AdminSession;
