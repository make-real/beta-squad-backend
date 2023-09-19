const { Schema, model } = require("mongoose");

const spaceFileSchema = new Schema(
	{
		title: {
			type: String,
			required: true,
		},
		subtitle: {
			type: String,
		},
		spaceRef: {
			type: Schema.Types.ObjectId,
			ref: "Space",
			required: true,
		},
		link: {
			type: String,
			required: true,
		},
		logo: {
			type: String,
		},
		createdBy: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
	},
	{
		timestamps: true,
	}
);

const SpaceFile = model("SpaceFile", spaceFileSchema);

module.exports = SpaceFile;
