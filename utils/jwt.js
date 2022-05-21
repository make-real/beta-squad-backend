const jwt = require("jsonwebtoken");

/**
 * Create a JWT token
 *
 * @param {String} id User ID
 * @param {STring} sessionId Session id of this token
 * @returns JWT token
 */
function createToken(id, sessionUUID) {
	return jwt.sign(
		{
			sessionId: id,
			sessionUUID,
		},
		process.env.JWT_SECRET
	);
}

/**
 * Parse JWT
 *
 * @param {String} token Json Web Token
 * @returns Data of this token
 */
function parseJWT(token) {
	try {
		return jwt.verify(token, process.env.JWT_SECRET);
	} catch (err) {
		return { error: err.message };
	}
}

module.exports = { createToken, parseJWT };
