const { Schema, model } = require("mongoose");

const emailNewsletterSchema = new Schema(
	{
		email: {
			type: String,
			required: true,
		},
		verified: {
			type: Boolean,
			default: false,
		},
	},
	{ timestamps: true }
);

const EmailNewsletter = model("EmailNewsletter", emailNewsletterSchema);

module.exports = EmailNewsletter;
