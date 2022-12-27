const http = require("http");
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const logger = require("morgan");
require("dotenv").config();
require("./config/cloudinary")(); // configured cloudinary

const databaseConnection = require("./config/database");
const indexRouter = require("./routes/index");

const app = express();

const server = http.createServer(app);

// Socket Server
const io = require("socket.io")(server, {
	cors: {
		origin: "*",
		methods: ["GET", "POST"],
	},
});
global.io = io;

// socket server binding
const socketServer = require("./socket/socket-server");
socketServer();

// Middleware Array
const middleware = [logger("dev"), cors(), express.static("public"), express.urlencoded({ extended: true }), express.json(), cookieParser()];
app.use(middleware);
console.clear();

app.use(indexRouter);

// Database
databaseConnection();

const port = process.env.PORT || 5000;

server.listen(port, () => {
	console.log("Server running on port " + port);
});

require("./utils/background-job");
