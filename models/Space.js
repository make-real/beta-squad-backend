const { Schema, model } = require("mongoose");

const spaceSchema = new Schema(
	{
		name: {
			type: String,
			required: true,
		},
		workSpaceRef: {
			type: Schema.Types.ObjectId,
			ref: "Workspace",
			required: true,
		},
		description: String,
		color: {
			type: String,
			default: "#7850fc",
		},
		members: {
			type: [
				{
					member: {
						type: Schema.Types.ObjectId,
						ref: "User",
					},
					role: {
						type: String,
						enum: ["admin", "member"],
						default: "member",
					},
				},
			],
			select: false,
		},
	},
	{
		timestamps: true,
	}
);

const Space = model("Space", spaceSchema);

module.exports = Space;
