const { Schema, model } = require("mongoose");

const userSchema = new Schema(
	{
		fullName: {
			type: String,
			required: true,
		},
		email: {
			type: String,
			required: true,
		},
		phone: {
			type: String,
		},
		password: {
			type: String,
			required: true,
			select: false,
		},
		emailVerified: {
			type: Boolean,
			default: false,
			select: false,
		},
		phoneVerified: {
			type: Boolean,
			default: false,
			select: false,
		},
		avatar: {
			type: String,
		},
	},
	{
		timestamps: true,
	}
);

const User = model("User", userSchema);

module.exports = User;
