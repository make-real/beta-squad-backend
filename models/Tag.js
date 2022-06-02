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
				const colors = ["#7fc241", "#00d4a0", "#ff8c94", "#ff693b", "#fbcb53", "#47c6d8", "#635f63", "#47b9ea", "#838cff", "#ff8900"];
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
