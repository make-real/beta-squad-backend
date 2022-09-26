const { Schema, model } = require("mongoose");

const chatHeaderSchema = new Schema(
	{
		participants: {
			type: [
				{
					user: {
						type: Schema.Types.ObjectId,
						ref: "User",
						required: true,
					},
				},
			],
		},
		workSpaceRef: {
			type: Schema.Types.ObjectId,
			ref: "Workspace",
			required: true,
		},
		lastMessageTime: {
			type: Date,
		},
	},
	{
		timestamps: true,
	}
);

const ChatHeader = model("ChatHeader", chatHeaderSchema);

module.exports = ChatHeader;
