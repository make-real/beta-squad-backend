const { Schema, model } = require("mongoose");

const chatSchema = new Schema(
	{
		sender: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		to: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		chatHeaderRef: {
			type: Schema.Types.ObjectId,
			ref: "ChatHeader",
			required: true,
		},
		replayOf: {
			type: Schema.Types.ObjectId,
			ref: "Chat",
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
		seenBy: {
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

const Chat = model("Chat", chatSchema);

module.exports = Chat;
