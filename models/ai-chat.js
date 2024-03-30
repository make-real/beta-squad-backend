const { Schema, model } = require("mongoose");

const messageSchema = new Schema(
	{
		message: {
			type: String,
		},
		aiResponse: {
			type: String,
		},
	},
	{ _id: false },
);

const aiChatHistorySchema = new Schema(
	{
		spaceRef: {
			type: Schema.Types.ObjectId,
			ref: "Space",
			required: true,
		},
		message: {
			type: String,
		},
		successMessage: [messageSchema],
		failedMessage: [messageSchema],
		workSpaceRef: {
			type: Schema.Types.ObjectId,
			ref: "Workspace",
			required: true,
		},
		sender: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
	},
	{ timestamps: true },
);

const aiChatHistory = model("ai_chat", aiChatHistorySchema);

module.exports = aiChatHistory;
