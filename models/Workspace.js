const { Schema, model } = require("mongoose");

const workspaceSchema = new Schema(
	{
		name: {
			type: String,
			required: true,
		},
		owner: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		avatar: {
			type: String,
		},
	},
	{
		timestamps: true,
	}
);

const Workspace = model("Workspace", workspaceSchema);

module.exports = Workspace;
