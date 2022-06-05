const { Schema, model } = require("mongoose");

const checklistSchema = new Schema(
	{
		content: {
			type: String,
			required: true,
		},
		checked: {
			type: Boolean,
			default: false,
		},
		assignee: {
			type: [
				{
					type: Schema.Types.ObjectId,
					ref: "User",
				},
			],
			select: false,
		},
		spaceRef: {
			type: Schema.Types.ObjectId,
			ref: "Space",
			required: true,
		},
		cardRef: {
			type: Schema.Types.ObjectId,
			ref: "Card",
			required: true,
		},
	},
	{
		timestamps: true,
	}
);

const Checklist = model("Checklist", checklistSchema);

module.exports = Checklist;
