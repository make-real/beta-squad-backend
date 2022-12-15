const { Schema, model } = require("mongoose");

const commentChatSchema = new Schema(
	{
		sender: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		to: {
			type: Schema.Types.ObjectId,
			ref: "Card",
			required: true,
		},
		spaceRef: {
			type: Schema.Types.ObjectId,
			ref: "Space",
			required: true,
		},
		replayOf: {
			type: Schema.Types.ObjectId,
			ref: "CommentChat",
		},
		content: {
			type: {
				text: String,
				attachments: [
					{
						type: String,
					},
				],
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

const CommentChat = model("CommentChat", commentChatSchema);

module.exports = CommentChat;
