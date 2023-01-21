const { Schema, model } = require("mongoose");

const userSchema = new Schema(
	{
		fullName: {
			type: String,
			required: true,
		},
		uid: {
			type: Number,
			unique: true,
			required: true,
			default: () => Math.floor(Math.random() * 900000) + 100000,
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
			required: function () {
				if (!this.guest) {
					return true;
				}
			},
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
		guest: {
			type: Boolean,
			select: false,
		},
	},
	{
		timestamps: true,
	}
);

const User = model("User", userSchema);

module.exports = User;
