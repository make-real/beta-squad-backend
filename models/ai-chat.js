const { Schema, model } = require("mongoose");

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
		status: {
			type: String,
		},
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
