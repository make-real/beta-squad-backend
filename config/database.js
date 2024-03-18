const mongoose = require("mongoose");
mongoose.set("strictQuery", true);
require("dotenv").config();

function databaseConnection() {
	const { DB_URI_CLOUD, DB_URI_LOCAL, NODE_ENV } = process.env;

	const URL = NODE_ENV === "production" ? DB_URI_CLOUD : DB_URI_CLOUD;

	mongoose
		.connect(URL, { useUnifiedTopology: true, useNewUrlParser: true })
		.then(() => {
			console.log(`Database connected to ${NODE_ENV === "production" ? "Cloud" : "Cloud"}`);
		})
		.catch((e) => {
			return console.log(e);
		});
}

module.exports = databaseConnection;
