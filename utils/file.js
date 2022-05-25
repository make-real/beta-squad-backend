const cloudinary = require("cloudinary").v2;

/**
 * Check file is an image or not
 *
 * @param {File} file File object
 */
const imageCheck = (image) => {
	let message, status;

	if (image && image.type) {
		const isImage = image.type.startsWith("image/");
		if (isImage) {
			status = true;
		} else {
			message = "Only image files are allowed!";
		}
	} else {
		message = "Image field is empty!";
	}

	return { status, message };
};

/**
 * Upload a file
 *
 * @param {string} filePath Path of the file
 * @returns promise
 */
const upload = async (filePath, width, height) => {
	try {
		if (width && height) {
			return await cloudinary.uploader.upload(filePath, { width, height });
		} else {
			return await cloudinary.uploader.upload(filePath);
		}
	} catch (err) {
		return { message: err.message || "Failed to upload file" };
	}
};

module.exports = { imageCheck, upload };
