const admin = require("firebase-admin");

const serviceAccount = require("./beta-squad-firebase-adminsdk.json");

const firebase = admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
});

module.exports = firebase;
