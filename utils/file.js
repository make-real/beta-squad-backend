const fs = require("fs");

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

async function multipleFilesCheckAndUpload(files) {
	const filesUrl = [];
	let errorMessage;
	if (files) {
		if (files.length === undefined) {
			files = [files];
		} else {
			files = files;
		}

		// check files
		let filesOk;
		for (const file of files) {
			if (file.size > 0) {
				if (!file.type) {
					break;
				}
			} else {
				break;
			}
			filesOk = true;
		}

		// files upload
		if (filesOk) {
			for (const file of files) {
				const uploadResult = await upload(file.path);
				if (uploadResult.secure_url) {
					filesUrl.push(uploadResult.secure_url);
				} else {
					errorMessage = uploadResult.message;
					break;
				}
			}
		} else {
			errorMessage = "There is an error with upload files!";
		}
	}

	return { filesUrl, errorMessage };
}

/**
 * Upload a file
 *
 * @param {string} filePath Path of the file
 * @returns promise
 */
const upload = async (filePath, width, height) => {
	try {
		let rt;
		if (width && height) {
			rt = await cloudinary.uploader.upload(filePath, { width, height });
		} else {
			rt = await cloudinary.uploader.upload(filePath, { resource_type: "raw" });
		}

		fs.unlinkSync(filePath);
		return rt;
	} catch (err) {
		return { message: err.message || "Failed to upload file" };
	}
};

module.exports = { imageCheck, multipleFilesCheckAndUpload, upload };
