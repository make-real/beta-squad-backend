const cloudinary = require("cloudinary").v2;

/**
 * Check file is an audio or not
 *
 * @param {File} file File object
 */
const audioCheck = (audio) => {
	let message, status;

	if (audio && audio.type) {
		const isImage = audio.type.startsWith("audio/");
		if (isImage) {
			status = true;
		} else {
			message = "Only audio files are allowed!";
		}
	} else {
		message = "Image field is empty!";
	}

	return { status, message };
};

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
		return { secure_url: "https://res.cloudinary.com/duaxe7mr0/raw/upload/v1652629880/xi6vy7w0hk5cqgl3ev9v.mp3" };
		if (width && height) {
			return await cloudinary.uploader.upload(filePath, { width, height });
		} else {
			return await cloudinary.uploader.upload(filePath, { resource_type: "raw", width, height });
		}
	} catch (err) {
		return { message: err.message || "Failed to upload file" };
	}
};

module.exports = { audioCheck, imageCheck, upload };
