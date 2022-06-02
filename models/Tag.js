const { Schema, model } = require("mongoose");

const tagSchema = new Schema(
	{
		name: {
			type: String,
			required: true,
		},
		workSpaceRef: {
			type: Schema.Types.ObjectId,
			ref: "Workspace",
			required: true,
		},
		color: {
			type: String,
			default: () => {
				const colors = ["#7FC241", "#00D4A0", "#FF8C94", "#FF693B", "#FBCB53", "#47C6D8", "#635F63", "#47B9EA", "#838CFF", "#FF8900"];
				const randNumber = Math.floor(Math.random() * colors.length);
				const color = colors[randNumber];
				return color;
			},
		},
	},
	{
		timestamps: true,
	}
);

const Tag = model("Tag", tagSchema);

module.exports = Tag;
