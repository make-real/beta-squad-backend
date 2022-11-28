const { Schema, model } = require("mongoose");

const notificationSchema = new Schema(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: "User",
		},
		message: {
			type: String,
			required: true,
		},
		seen: {
			type: Boolean,
			default: false,
		},
		type: {
			type: String,
		},
	},
	{
		timestamps: true,
	}
);

const Notification = model("Notification", notificationSchema);
module.exports = Notification;
