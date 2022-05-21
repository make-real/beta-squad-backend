const router = require("express").Router();

const apiRoutes = require("../api/routes/index");

router.all("/", (req, res, next) => {
	try {
		return res.send("Server running");
	} catch (err) {
		next(err);
	}
});

router.use("/api", apiRoutes); // rest api routes

// catch 404 and forward to error handler
router.use((req, res, next) => {
	return res.status(404).json({
		issue: {
			message: "404 | Resource not found!",
		},
	});
});

// error handler
router.use((err, req, res, next) => {
	console.error(err);

	const statusCode = err.status || 500;
	const issue = {};

	issue.message = `${err.message}`;
	issue.stack = process.env.NODE_ENV !== "production" ? err.stack : "";

	return res.status(statusCode).json({ issue });
});

module.exports = router;
