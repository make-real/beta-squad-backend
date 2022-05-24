const { isValidObjectId } = require("mongoose");

const Workspace = require("../../models/Workspace");
const Space = require("../../models/Space");

exports.createSpace = async (req, res, next) => {
	let { workspaceId, name, color, privacy } = req.body;
	try {
		const user = req.user;
		const issue = {};
		let workspaceIdOk, nameOk, colorOk, privacyOk;

		// workspaceId check
		if (workspaceId) {
			if (isValidObjectId(workspaceId)) {
				const workspaceExists = await Workspace.exists({ _id: workspaceId });
				if (workspaceExists) {
					workspaceIdOk = true;
				} else {
					issue.workspaceId = "Workspace not found!";
				}
			} else {
				issue.workspaceId = "Invalid workspace Id!";
			}
		} else {
			issue.workspaceId = "Please provide workspace Id!";
		}

		// name check
		if (name) {
			const letters = /^[A-Za-z0-9\s]+$/;
			name = String(name).replace(/  +/g, " ").trim();
			const validName = name.match(letters);
			if (validName) {
				const exists = await Space.exists({ $and: [{ workSpaceRef: isValidObjectId(workspaceId) ? workspaceId : undefined }, { name: new RegExp(`^${name}$`, "i") }] });
				if (!exists) {
					nameOk = true;
				} else {
					issue.name = "Duplicate space name!";
				}
			} else {
				issue.name = "Space name is not valid!";
			}
		} else {
			issue.name = "Please enter your space name!";
		}

		// color check

		if (String(color)) {
			color = String(color).toLowerCase().trim();
			color = color.startsWith("#") ? color : `#${color}`;
			const isValidHexColor = /^#[0-9A-F]{6}$/i.test(color);
			if (isValidHexColor) {
				colorOk = true;
			} else {
				issue.color = "Invalid color!";
			}
		} else {
			colorOk = true;
		}

		// privacy check
		if (privacy) {
			privacy = String(privacy).toLowerCase().trim();
			if (["public", "private"].includes(privacy)) {
				privacyOk = true;
			} else {
				issue.privacy = "Invalid privacy keyword!";
			}
		} else {
			privacyOk = true;
		}

		if (workspaceIdOk && nameOk && colorOk && privacyOk) {
			const spaceStructure = new Space({
				name,
				workSpaceRef: workspaceId,
				privacy,
				color,
				members: [
					{
						member: user._id,
						role: "manager",
					},
				],
			});

			const saveSpace = await spaceStructure.save();
			const space = {
				_id: saveSpace._id,
				name: saveSpace.name,
				color: saveSpace.color,
				privacy: saveSpace.privacy,
			};

			return res.status(201).json({ space });
		}

		return res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};

exports.getSpace = async (req, res, next) => {
	let { workspaceId, limit, skip } = req.query;
	try {
		limit = parseInt(limit) || 20;
		skip = parseInt(skip) || 0;
		const user = req.user;
		const issue = {};

		if (workspaceId) {
			if (isValidObjectId(workspaceId)) {
				const getSpace = await Space.find({ $and: [{ "members.member": user._id }, { workSpaceRef: workspaceId }] })
					.sort({ createdAt: -1 })
					.skip(skip)
					.limit(limit);

				return res.send({ spaces: getSpace });
			} else {
				issue.message = "Invalid workspace id!";
			}
		} else {
			issue.message = "Please provide workspace id!";
		}

		return res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};
