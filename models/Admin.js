const { Schema, model } = require("mongoose");

const adminSchema = new Schema(
	{
		name: {
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
		password: {
			type: String,
			required: true,
			select: false,
		},
		avatar: {
			type: String,
		},
		role: {
			type: String,
			enum: ["admin", "moderator"],
			default: "admin",
		},
	},
	{
		timestamps: true,
	}
);

const Admin = model("Admin", adminSchema);

module.exports = Admin;
