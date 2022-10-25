const { Schema, model } = require("mongoose");

const userSchema = new Schema(
	{
		fullName: {
			type: String,
			required: true,
		},
		username: {
			type: String,
			unique: true,
			required: true,
		},
		email: {
			type: String,
			unique: true,
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
		socketId: {
			type: String,
			select: false,
		},
		lastOnline: {
			type: Date,
			default: new Date(),
		},
	},
	{
		timestamps: true,
	}
);

const User = model("User", userSchema);

module.exports = User;
