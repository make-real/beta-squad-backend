const { Schema, model } = require("mongoose");

const errorLogSchema = new Schema(
	{
		path: String,
		method: String,
		error: {},
		description: String,
		payload: {
			body: {},
			params: {},
			query: {},
			headers: {},
		},
	},
	{
		timestamps: true,
	}
);

const ErrorLog = model("ErrorLog", errorLogSchema);

module.exports = ErrorLog;
