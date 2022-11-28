const { Schema, model } = require("mongoose");

const workspaceSettingSchema = new Schema(
	{
		workSpace: {
			type: Schema.Types.ObjectId,
			ref: "Workspace",
			required: true,
		},
		user: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		notificationDeliverySettings: {
			popUpNotification: {
				type: Boolean,
				default: true,
			},
			emailNotification: {
				type: Boolean,
				default: false,
			},
			soundNotification: {
				type: Boolean,
				default: true,
			},
			pushNotification: {
				type: Boolean,
				default: true,
			},
		},
	},
	{
		timestamps: true,
	}
);

const WorkspaceSetting = model("WorkspaceSetting", workspaceSettingSchema);
module.exports = WorkspaceSetting;
