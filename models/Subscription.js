const { Schema, model } = require("mongoose");

const subscriptionSchema = new Schema(
	{
		type: {
			type: String,
			required: true,
			enum: ["PAID_SUB", "TRIAL_SUB"],
			default: "TRIAL_SUB",
		},
		amount: Number,
		paid: {
			type: Boolean,
			required: true,
		},
		stop: {
			type: Boolean,
			default: false,
			required: true,
		},
		user: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		startDate: {
			type: Date,
			default: () => {
				return new Date();
			},
			required: true,
		},
		expiredDate: {
			type: Date,
			required: true,
		},
	},
	{
		timestamps: true,
	}
);

const Subscription = model("Subscription", subscriptionSchema);

module.exports = Subscription;
