const { isValidObjectId } = require("mongoose");
const Workspace = require("../../models/Workspace");
const Space = require("../../models/Space");
const { imageCheck, upload } = require("../../utils/file");
const { isValidEmail } = require("../../utils/func");
const User = require("../../models/User");

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
					initialSpace: "yes",
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

		const getWorkspace = await Workspace.find({ "teamMembers.member": user._id }).sort({ createdAt: -1 }).skip(skip).limit(limit);

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
									$elemMatch: {
										$or: [
											{ member: user._id, role: "owner" },
											{ member: user._id, role: "admin" },
										],
									},
								},
							},
						],
					});
					if (doIHaveAccessToUpdate) {
						workspaceIdOk = true;
					} else {
						issue.workspaceId = "You can't update the Workspace!";
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

				if (updateSpace.modifiedCount) {
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

/**
 * Add team members to workspace
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.addTeamMembers = async (req, res, next) => {
	let { workspaceId } = req.params;
	let { userEmail } = req.body;

	try {
		const user = req.user;
		const issue = {};

		if (workspaceId) {
			if (isValidObjectId(workspaceId)) {
				const workspaceExists = await Workspace.exists({ _id: workspaceId });
				if (workspaceExists) {
					const doIHaveAccessToUpdate = await Workspace.exists({
						$and: [
							{ _id: workspaceId },
							{
								teamMembers: {
									$elemMatch: {
										$or: [
											{ member: user._id, role: "owner" },
											{ member: user._id, role: "admin" },
										],
									},
								},
							},
						],
					});
					if (doIHaveAccessToUpdate) {
						userEmail = String(userEmail).replace(/  +/g, "").trim();
						if (userEmail && isValidEmail(userEmail)) {
							const userExists = await User.findOne({ email: userEmail }).select("_id");
							if (userExists) {
								const allReadyExistsInWorkspace = await Workspace.exists({ $and: [{ _id: workspaceId }, { "teamMembers.member": userExists._id }] });
								if (!allReadyExistsInWorkspace) {
									const pushTeamMembersInWorkspace = await Workspace.updateOne(
										{ _id: workspaceId },
										{
											$push: {
												teamMembers: {
													member: userExists._id,
												},
											},
										}
									);

									if (pushTeamMembersInWorkspace.modifiedCount) {
										// also add the member to the Default(Onboarding) space of the Workspace
										const findDefaultSpace = await await Space.findOne({ $and: [{ workSpaceRef: workspaceId }, { initialSpace: "yes" }] }).select("_id");
										if (findDefaultSpace) {
											const alreadyAddedMember = await await Space.exists({ $and: [{ _id: findDefaultSpace._id }, { "members.member": userExists._id }] });
											if (!alreadyAddedMember) {
												await Space.updateOne(
													{ _id: findDefaultSpace._id },
													{
														$push: {
															members: {
																member: userExists._id,
															},
														},
													}
												);
											}
										}

										return res.json({ message: "Successfully added the user to the workspace as a team member!" });
									} else {
										issue.message = "Failed to updated!";
									}
								} else {
									issue.message = "The user is already exists in the workspace!";
								}
							} else {
								issue.message = "Not found user with the email!";
							}
						} else {
							if (!userEmail) {
								issue.message = "Please provide user email!";
							} else {
								issue.message = "Provided user email is invalid!";
							}
						}
					} else {
						issue.message = "You have no access to perform the operation!";
					}
				} else {
					issue.message = "Workspace not found";
				}
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
