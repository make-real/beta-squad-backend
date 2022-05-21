const mongoose = require("mongoose");

function databaseConnection() {
	const { DB_URI_CLOUD, DB_URI_LOCAL, NODE_ENV } = process.env;

	const URL = NODE_ENV === "production" ? DB_URI_CLOUD : DB_URI_LOCAL;

	mongoose
		.connect(URL, { useUnifiedTopology: true, useNewUrlParser: true })
		.then(() => {
			console.log(`Database connected to ${NODE_ENV === "production" ? "Cloud" : "Local"}`);
		})
		.catch((e) => {
			return console.log(e);
		});
}

module.exports = databaseConnection;
