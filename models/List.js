const { Schema, model } = require("mongoose");

const listSchema = new Schema(
	{
		name: {
			type: String,
			required: true,
		},
		spaceRef: {
			type: Schema.Types.ObjectId,
			ref: "Space",
			required: true,
		},
		creator: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
	},
	{
		timestamps: true,
	}
);

const List = model("List", listSchema);

module.exports = List;
