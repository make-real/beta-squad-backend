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
		privacy: {
			type: String,
			enum: ["public", "private"],
			default: "public",
		},
		members: {
			type: [
				{
					_id: false,
					member: {
						type: Schema.Types.ObjectId,
						ref: "User",
					},
					role: {
						type: String,
						enum: ["manager", "member"],
						default: "member",
					},
				},
			],
			select: false,
		},
		initialSpace: String,
	},
	{
		timestamps: true,
	}
);

const Space = model("Space", spaceSchema);

module.exports = Space;
