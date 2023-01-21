const { Schema, model } = require("mongoose");

const callSchema = new Schema(
	{
		type: {
			type: String,
			enum: ["audio", "video"],
		},
		channelId: {
			type: String,
			require: true,
		},
		callerId: {
			type: Schema.Types.ObjectId,
			ref: "User",
		},
		space: {
			type: Schema.Types.ObjectId,
			refPath: "target",
		},
		target: {
			type: String,
			enums: ["User", "Space"],
			required: true,
		},
		participants: [
			{
				camera_off: {
					type: Boolean,
					default: true,
				},
				mic_muted: {
					type: Boolean,
					default: false,
				},
				user: {
					type: Schema.Types.ObjectId,
					ref: "User",
				},
			},
		],
	},
	{
		timestamps: true,
	}
);

const Call = model("Call", callSchema);

module.exports = Call;
