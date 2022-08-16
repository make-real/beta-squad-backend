const { isValidObjectId } = require("mongoose");
const { imageCheck, upload } = require("../../utils/file");
const { isValidEmail } = require("../../utils/func");
const { defaultTags } = require("../../config/centralVariables");
const User = require("../../models/User");
const Workspace = require("../../models/Workspace");
const Space = require("../../models/Space");
const Card = require("../../models/Card");
const Tag = require("../../models/Tag");

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

				// initial or default Tags create
				const arr = [];
				for (const tag of defaultTags) {
					if (tag.name) {
						arr.push({
							name: tag.name,
							color: tag.color,
							workSpaceRef: saveWorkspace._id,
						});
					}
				}
				if (arr.length > 0) {
					await Tag.create(arr);
				}
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
exports.getWorkspaces = async (req, res, next) => {
	let { limit, skip } = req.query;
	try {
		const user = req.user;
		limit = parseInt(limit) || 10;
		skip = parseInt(skip) || 0;

		const getWorkspace = await Workspace.find({ "teamMembers.member": user._id }).sort({ createdAt: -1 }).skip(skip).limit(limit);

		return res.json({ workspaces: getWorkspace });
	} catch (err) {
		next(err);
	}
};

/**
 * Get single workspace
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.getSingleWorkspace = async (req, res, next) => {
	let { workspaceId } = req.params;

	try {
		const user = req.user;
		const issue = {};

		// check workspace id
		if (workspaceId) {
			if (isValidObjectId(workspaceId)) {
				const workspaceExists = await Workspace.findOne({ _id: workspaceId });
				if (workspaceExists) {
					const doIHaveAccess = await Workspace.exists({
						$and: [{ _id: workspaceId }, { "teamMembers.member": user._id }],
					});
					if (doIHaveAccess) {
						return res.json({ workspace: workspaceExists });
					} else {
						issue.workspaceId = "You have no access in this Workspace!";
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

		return res.status(400).json({ issue });
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
					const getUpdatedWorkspace = await Workspace.findOne({ _id: workspaceId });
					return res.json({ message: "Successfully updated", workspace: getUpdatedWorkspace });
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

/**
 * Role Change and remove members of a workspace
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.roleChangeAndRemoveTeamMembers = async (req, res, next) => {
	let { workspaceId } = req.params;
	let { memberId, requestFor } = req.body;

	try {
		const user = req.user;
		const issue = {};

		if (workspaceId) {
			if (isValidObjectId(workspaceId)) {
				requestFor = requestFor != undefined ? String(requestFor).toLowerCase() : undefined;
				if (["admin", "user", "remove"].includes(requestFor)) {
					const workspaceExists = await Workspace.exists({ _id: workspaceId });
					if (workspaceExists) {
						const doIHaveAccess = await Workspace.exists({
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
						if (doIHaveAccess) {
							if (memberId && isValidObjectId(memberId)) {
								const userExists = await User.findOne({ _id: memberId }).select("_id");
								if (userExists) {
									const existsInWorkspace = await Workspace.exists({ $and: [{ _id: workspaceId }, { "teamMembers.member": userExists._id }] });
									if (existsInWorkspace) {
										const iAmOwnerInTheWorkSpace = await Workspace.exists({
											$and: [
												{ _id: workspaceId },
												{
													teamMembers: {
														$elemMatch: {
															member: user._id,
															role: "owner",
														},
													},
												},
											],
										});

										const memberOwnerInTheWorkSpace = await Workspace.exists({
											$and: [
												{ _id: workspaceId },
												{
													teamMembers: {
														$elemMatch: {
															member: memberId,
															role: "owner",
														},
													},
												},
											],
										});

										if (iAmOwnerInTheWorkSpace || (!iAmOwnerInTheWorkSpace && !memberOwnerInTheWorkSpace)) {
											if (requestFor != "remove") {
												await Workspace.updateOne(
													{
														$and: [{ _id: workspaceId }, { "teamMembers.member": memberId }],
													},
													{ $set: { "teamMembers.$.role": requestFor } }
												);

												return res.json({ message: `Successfully role changed to ${requestFor}` });
											} else {
												await Workspace.updateOne(
													{ _id: workspaceId },
													{
														$pull: {
															teamMembers: {
																member: memberId,
															},
														},
													}
												);

												// also remove the member from the spaces of the Workspace
												await Space.updateOne(
													{ $and: [{ workSpaceRef: workspaceId }, { "members.member": memberId }] },
													{
														$pull: {
															members: {
																member: memberId,
															},
														},
													}
												);

												return res.json({ message: "Successfully remove member from the workspace" });
											}
										} else {
											if (!iAmOwnerInTheWorkSpace && memberOwnerInTheWorkSpace) {
												issue.message = "You can take action to the owner!";
											}
										}
									} else {
										issue.message = "The user is not exists in the workspace!";
									}
								} else {
									issue.message = "Not found user!";
								}
							} else {
								if (!memberId) {
									issue.message = "Please provide member id!";
								} else {
									issue.message = "Provided member is invalid!";
								}
							}
						} else {
							issue.message = "You have no access to perform the operation!";
						}
					} else {
						issue.message = "Workspace not found";
					}
				} else {
					if (!requestFor) {
						issue.message = "Please provide requestFor keyword!";
					} else {
						issue.message = "Invalid keyword!";
					}
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

/**
 * Ownership Transfer of workspace
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.ownerShipTransferOfWorkspace = async (req, res, next) => {
	let { workspaceId } = req.params;
	let { memberId } = req.body;

	try {
		const user = req.user;
		const issue = {};

		if (workspaceId) {
			if (isValidObjectId(workspaceId)) {
				const workspaceExists = await Workspace.exists({ _id: workspaceId });
				if (workspaceExists) {
					const doIHaveAccess = await Workspace.exists({
						$and: [
							{ _id: workspaceId },
							{
								teamMembers: {
									$elemMatch: {
										member: user._id,
										role: "owner",
									},
								},
							},
						],
					});
					if (doIHaveAccess) {
						if (memberId && isValidObjectId(memberId)) {
							const userExists = await User.findOne({ _id: memberId }).select("_id");
							if (userExists) {
								const existsInWorkspace = await Workspace.exists({ $and: [{ _id: workspaceId }, { "teamMembers.member": memberId }] });
								if (existsInWorkspace) {
									await Workspace.updateOne(
										{
											$and: [{ _id: workspaceId }, { "teamMembers.member": memberId }],
										},
										{ $set: { "teamMembers.$.role": "owner" } }
									);

									await Workspace.updateOne(
										{
											$and: [{ _id: workspaceId }, { "teamMembers.member": user._id }],
										},
										{ $set: { "teamMembers.$.role": "user" } }
									);

									return res.json({ message: "Successfully Transferred ownership of the workspace" });
								} else {
									issue.message = "The user is not exists in the workspace!";
								}
							} else {
								issue.message = "Not found user!";
							}
						} else {
							if (!memberId) {
								issue.message = "Please provide member id!";
							} else {
								issue.message = "Provided member is invalid!";
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

/**
 * TAGS CRUD ===============================================
 * =========================================================
 * =========================================================
 * =========================================================
 * =========================================================
 */

/**
 * Create tags under a workspace
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.createTags = async (req, res, next) => {
	let { workspaceId } = req.params;
	let { name, color } = req.body;

	try {
		const user = req.user;
		const issue = {};

		let nameOk, colorOk;

		// Tag name check
		if (name) {
			const letters = /^[A-Za-z\s]+$/; // Name char validation
			name = String(name)
				.replace(/\r\n/g, " ")
				.replace(/[\r\n]/g, " ")
				.replace(/  +/g, " ")
				.trim();
			const validFirstName = name.match(letters);
			if (validFirstName) {
				nameOk = true;
			} else {
				issue.message = "Tag name is not valid!";
			}
		} else {
			issue.message = "Please provide tag name!";
		}

		// color check
		if (color) {
			color = String(color).toLowerCase().trim();
			color = color.startsWith("#") ? color : `#${color}`;
			const isValidHexColor = /^#[0-9A-F]{6}$/i.test(color);
			if (isValidHexColor) {
				colorOk = true;
			} else {
				issue.color = "Invalid color hex code!";
			}
		} else {
			color = undefined;
			colorOk = true;
		}

		if (nameOk && colorOk) {
			if (workspaceId) {
				if (isValidObjectId(workspaceId)) {
					const workspaceExists = await Workspace.exists({ _id: workspaceId });
					if (workspaceExists) {
						const doIHaveAccessToCreateTag = await Workspace.exists({
							$and: [
								{ _id: workspaceId },
								{
									"teamMembers.member": user._id,
								},
							],
						});
						if (doIHaveAccessToCreateTag) {
							const duplicateTag = await Tag.exists({ $and: [{ workSpaceRef: workspaceId }, { name: new RegExp(`^${name}$`, "i") }] });
							if (!duplicateTag) {
								const tagStructure = new Tag({
									name,
									color,
									workSpaceRef: workspaceId,
								});

								const createTag = await tagStructure.save();

								return res.status(201).json({ tag: createTag });
							} else {
								issue.message = "Do not allow duplicate tags in the same workspace!";
							}
						} else {
							issue.message = "You are not a team member of the workplace!";
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
		}

		return res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};

/**
 * Get tags of a workspace
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.getTags = async (req, res, next) => {
	let { workspaceId } = req.params;

	let { limit, skip, countCards } = req.query;
	try {
		limit = parseInt(limit) || 30;
		skip = parseInt(skip) || 0;
		const user = req.user;
		const issue = {};

		if (workspaceId) {
			if (isValidObjectId(workspaceId)) {
				const workspaceExists = await Workspace.exists({ _id: workspaceId });
				if (workspaceExists) {
					const doIHaveAccessToGetTag = await Workspace.exists({
						$and: [
							{ _id: workspaceId },
							{
								"teamMembers.member": user._id,
							},
						],
					});
					if (doIHaveAccessToGetTag) {
						let getTags = await Tag.find({ workSpaceRef: workspaceId }).select("name color").sort({ createdAt: -1 }).skip(skip).limit(limit);

						if (countCards) {
							getTags = JSON.parse(JSON.stringify(getTags));
							for (const tag of getTags) {
								tag.countedCards = await Card.countDocuments({ tags: tag._id });
							}
						}

						return res.json({ tags: getTags });
					} else {
						issue.message = "You are not a team member of the workplace!";
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

/**
 * Edit a tags
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.editTags = async (req, res, next) => {
	let { workspaceId, tagId } = req.params;
	let { name, color } = req.body;

	try {
		const user = req.user;
		const issue = {};

		let nameOk, colorOk;

		// Tag name check
		if (name) {
			const letters = /^[A-Za-z\s]+$/; // Name char validation
			name = String(name)
				.replace(/\r\n/g, " ")
				.replace(/[\r\n]/g, " ")
				.replace(/  +/g, " ")
				.trim();
			const validFirstName = name.match(letters);
			if (validFirstName) {
				nameOk = true;
			} else {
				issue.message = "Tag name is not valid!";
			}
		} else {
			name = undefined;
			nameOk = true;
		}

		// color check
		if (color) {
			color = String(color).toLowerCase().trim();
			color = color.startsWith("#") ? color : `#${color}`;
			const isValidHexColor = /^#[0-9A-F]{6}$/i.test(color);
			if (isValidHexColor) {
				colorOk = true;
			} else {
				issue.color = "Invalid color hex code!";
			}
		} else {
			color = undefined;
			colorOk = true;
		}

		if (nameOk && colorOk) {
			if (workspaceId) {
				const isValidWorkspaceId = isValidObjectId(workspaceId);
				const isValidTagId = isValidObjectId(tagId);
				if (isValidWorkspaceId && isValidTagId) {
					const workspaceExists = await Workspace.exists({ _id: workspaceId });
					if (workspaceExists) {
						const doIHaveAccessToUpdateTag = await Workspace.exists({
							$and: [
								{ _id: workspaceId },
								{
									"teamMembers.member": user._id,
								},
							],
						});
						if (doIHaveAccessToUpdateTag) {
							const tagExists = await Tag.exists({ _id: tagId });
							if (tagExists) {
								const tagExistsInWorkspace = await Tag.exists({ $and: [{ _id: tagId }, { workSpaceRef: workspaceId }] });
								if (tagExistsInWorkspace) {
									const duplicateTag = await Tag.exists({ $and: [{ _id: { $ne: tagId } }, { workSpaceRef: workspaceId }, { name: new RegExp(`^${name}$`, "i") }] });
									if (!duplicateTag) {
										const updateTag = await Tag.updateOne({ _id: tagId }, { name, color });

										if (updateTag.modifiedCount) {
											return res.json({ message: "Successfully updated the tag!" });
										} else {
											issue.message = "Failed to update the tag!";
										}
									} else {
										issue.message = "Do not allow duplicate tags in the same workspace!";
									}
								} else {
									issue.message = "Something is wrong!";
								}
							} else {
								issue.message = "Tag not found!";
							}
						} else {
							issue.message = "You are not a team member of the workplace!";
						}
					} else {
						issue.message = "Workspace not found";
					}
				} else {
					if (!isValidWorkspaceId) {
						issue.message = "Invalid workspace id!";
					} else if (!isValidTagId) {
						issue.message = "Invalid tag id!";
					}
				}
			} else {
				issue.message = "Please provide workspace id!";
			}
		}

		return res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};

/**
 * Delete a tags
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.deleteTags = async (req, res, next) => {
	let { workspaceId, tagId } = req.params;

	try {
		const user = req.user;
		const issue = {};

		if (workspaceId) {
			const isValidWorkspaceId = isValidObjectId(workspaceId);
			const isValidTagId = isValidObjectId(tagId);
			if (isValidWorkspaceId && isValidTagId) {
				const workspaceExists = await Workspace.exists({ _id: workspaceId });
				if (workspaceExists) {
					const doIHaveAccessToDeleteTag = await Workspace.exists({
						$and: [
							{ _id: workspaceId },
							{
								"teamMembers.member": user._id,
							},
						],
					});
					if (doIHaveAccessToDeleteTag) {
						const tagExists = await Tag.exists({ _id: tagId });
						if (tagExists) {
							const tagExistsInWorkspace = await Tag.exists({ $and: [{ _id: tagId }, { workSpaceRef: workspaceId }] });
							if (tagExistsInWorkspace) {
								const deleteTag = await Tag.deleteOne({ _id: tagId });

								if (deleteTag.deletedCount) {
									return res.json({ message: "Successfully deleted the tag!" });
								} else {
									issue.message = "Failed to delete the tag!";
								}
							} else {
								issue.message = "Something is wrong!";
							}
						} else {
							issue.message = "Already deleted the tag!";
						}
					} else {
						issue.message = "You are not a team member of the workplace!";
					}
				} else {
					issue.message = "Workspace not found";
				}
			} else {
				if (!isValidWorkspaceId) {
					issue.message = "Invalid workspace id!";
				} else if (!isValidTagId) {
					issue.message = "Invalid tag id!";
				}
			}
		} else {
			issue.message = "Please provide workspace id!";
		}

		return res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};
