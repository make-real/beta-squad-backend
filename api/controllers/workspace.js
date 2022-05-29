const { isValidObjectId } = require("mongoose");
const Workspace = require("../../models/Workspace");
const Space = require("../../models/Space");
const { imageCheck, upload } = require("../../utils/file");

/**
 * Create a workspace
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.createWorkspace = async (req, res, next) => {
	let { name } = req.body;
	try {
		const user = req.user;
		const issue = {};
		let nameOk;

		// name check
		if (name) {
			const letters = /^[A-Za-z0-9\s]+$/;
			name = String(name).replace(/  +/g, " ").trim();
			const validName = name.match(letters);
			if (validName) {
				const exists = await Workspace.exists({
					$and: [
						{
							teamMembers: {
								$elemMatch: { member: user._id, role: "owner" },
							},
						},
						{ name: new RegExp(`^${name}$`, "i") },
					],
				});
				if (!exists) {
					nameOk = true;
				} else {
					issue.name = "Duplicate workspace name!";
				}
			} else {
				issue.name = "Workspace name is not valid!";
			}
		} else {
			issue.name = "Please enter your workspace name!";
		}

		if (nameOk) {
			const workspaceStructure = new Workspace({
				name,
				owner: user._id,
				teamMembers: [
					{
						member: user._id,
						role: "owner",
					},
				],
			});

			const saveWorkspace = await workspaceStructure.save();
			const workspace = {
				_id: saveWorkspace._id,
				name: saveWorkspace.name,
			};

			if (saveWorkspace) {
				// initial Space create
				const spaceStructure = new Space({
					name: "Onboarding",
					workSpaceRef: saveWorkspace._id,
					members: [
						{
							member: user._id,
							role: "manager",
						},
					],
				});

				const initialSpace = await spaceStructure.save();
				workspace.initialSpaceId = initialSpace._id;
			}

			return res.status(201).json({ workspace });
		}

		return res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};

/**
 * Get workspace list
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.getWorkspace = async (req, res, next) => {
	let { limit, skip } = req.query;
	try {
		const user = req.user;
		limit = parseInt(limit) || 10;
		skip = parseInt(skip) || 0;

		const getSpaces = await Space.find({ "members.member": user._id }).select("workSpaceRef");

		const workspaceIds = [];
		for (const space of getSpaces) {
			workspaceIds.push(space.workSpaceRef);
		}

		const getWorkspace = await Workspace.find({ _id: { $in: workspaceIds } })
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit);

		return res.send({ workspaces: getWorkspace });
	} catch (err) {
		next(err);
	}
};

/**
 * Update workspace
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.updateWorkspace = async (req, res, next) => {
	let { workspaceId } = req.params;
	let { name } = req.body;

	try {
		const user = req.user;
		const issue = {};
		let workspaceIdOk, nameOk, logoOk;

		// check workspace id
		if (workspaceId) {
			if (isValidObjectId(workspaceId)) {
				var workspaceExists = await Workspace.exists({ _id: workspaceId });
				if (workspaceExists) {
					const doIHaveAccessToUpdate = await Workspace.exists({
						$and: [
							{ _id: workspaceId },
							{
								teamMembers: {
									$elemMatch: { member: user._id, role: "owner" },
								},
							},
						],
					});
					if (doIHaveAccessToUpdate) {
						workspaceIdOk = true;
					} else {
						issue.workspaceId = "Only owner can update the Workspace!";
					}
				} else {
					issue.workspaceId = "Workspace not found";
				}
			} else {
				issue.workspaceId = "Invalid workspace id!";
			}
		} else {
			issue.workspaceId = "Please provide workspace id!";
		}

		if (workspaceIdOk) {
			// name check
			if (name) {
				const letters = /^[A-Za-z0-9\s]+$/;
				name = String(name)
					.replace(/\r?\n|\r/g, "")
					.replace(/  +/g, " ")
					.trim();
				const validName = name.match(letters);
				if (validName) {
					const duplicateWorkspace = await Workspace.exists({
						$and: [
							{ _id: { $ne: workspaceId } },
							{
								teamMembers: {
									$elemMatch: { member: user._id, role: "owner" },
								},
							},
							{ name: new RegExp(`^${name}$`, "i") },
						],
					});

					if (!duplicateWorkspace) {
						nameOk = true;
					} else {
						issue.name = "Duplicate workspace name!";
					}
				} else {
					issue.name = "Workspace name is not valid!";
				}
			} else {
				nameOk = true;
			}
		}

		if (workspaceIdOk && nameOk) {
			if (req.files && req.files.logo) {
				const theLogo = req.files.logo;
				const checkImage = imageCheck(theLogo);
				if (checkImage.status) {
					var uploadResult = await upload(theLogo.path);
					if (uploadResult.secure_url) {
						logoOk = true;
						var logoUrl = uploadResult.secure_url;
					} else {
						issue.logo = uploadResult.message;
					}
				} else {
					issue.logo = checkImage.message;
				}
			} else {
				logoOk = true;
			}

			if (logoOk) {
				const updateSpace = await Workspace.updateOne(
					{ _id: workspaceId },
					{
						name,
						logo: logoUrl,
					}
				);

				if (updateSpace.matchedCount) {
					return res.json({ message: "Successfully updated" });
				} else {
					issue.space = "Failed to updated!";
				}
			}
		}

		return res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};
