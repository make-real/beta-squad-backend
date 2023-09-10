const { Schema, model } = require("mongoose");

const workspaceSchema = new Schema(
	{
		name: {
			type: String,
			required: true,
		},
		teamMembers: {
			type: [
				{
					_id: false,
					member: {
						type: Schema.Types.ObjectId,
						ref: "User",
						required: true,
					},
					role: {
						type: String,
						enum: ["owner", "admin", "user"],
						default: "user",
						required: true,
					},
					designation: {
						type: String,
					},
				},
			],
			select: false,
		},
		logo: {
			type: String,
		},
	},
	{
		timestamps: true,
	}
);

const Workspace = model("Workspace", workspaceSchema);

module.exports = Workspace;
