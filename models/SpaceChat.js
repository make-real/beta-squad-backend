const { Schema, model } = require("mongoose");

const spaceChatSchema = new Schema(
	{
		sender: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		to: {
			type: Schema.Types.ObjectId,
			ref: "Space",
			required: true,
		},
		replayOf: {
			type: Schema.Types.ObjectId,
			ref: "SpaceChat",
		},
		content: {
			type: {
				text: String,
				attachments: [
					{
						type: String,
					},
				],
				voice: String,
				mentionedUsers: [
					{
						type: Schema.Types.ObjectId,
						ref: "User",
					},
				],
			},
		},
		seen: {
			type: [
				{
					type: Schema.Types.ObjectId,
					ref: "User",
				},
			],
			select: false,
		},
		deleted: {
			type: Boolean,
			default: false,
			select: false,
		},
		reactions: {
			type: [
				{
					reactor: {
						type: Schema.Types.ObjectId,
						ref: "User",
						required: true,
					},
					reaction: {
						type: String,
						required: true,
					},
				},
			],
		},
		editedAt: Date,
	},
	{
		timestamps: true,
	}
);

const SpaceChat = model("SpaceChat", spaceChatSchema);

module.exports = SpaceChat;
