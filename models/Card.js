const { Schema, model } = require("mongoose");

const cardSchema = new Schema(
	{
		name: {
			type: String,
			required: true,
		},
		description: String,
		progress: {
			type: Number,
			default: 0,
			min: 0,
			max: 100,
		},
		tags: {
			type: [
				{
					type: Schema.Types.ObjectId,
					ref: "Tag",
				},
			],
			select: false,
		},
		attachments: [
			{
				type: String,
			},
		],
		startDate: Date,
		endDate: Date,
		order: {
			type: Number,
			required: true,
		},
		color: {
			type: String,
			required: true,
		},
		cardKey: {
			type: String,
			required: true,
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
		checkList: {
			type: [
				{
					type: Schema.Types.ObjectId,
					ref: "Checklist",
				},
			],
			select: false,
		},
		spaceRef: {
			type: Schema.Types.ObjectId,
			ref: "Space",
			required: true,
		},
		listRef: {
			type: Schema.Types.ObjectId,
			ref: "List",
			required: true,
		},
		creator: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
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
	},
	{
		timestamps: true,
	}
);

const Card = model("Card", cardSchema);

module.exports = Card;
