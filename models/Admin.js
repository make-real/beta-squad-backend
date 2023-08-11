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
	},
	{
		timestamps: true,
	}
);

const Admin = model("Admin", adminSchema);

module.exports = Admin;
