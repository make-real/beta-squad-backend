const { isValidObjectId } = require("mongoose");
const { defaultBoards } = require("../../../config/centralVariables");
const Workspace = require("../../../models/Workspace");
const Space = require("../../../models/Space");
const User = require("../../../models/User");
const List = require("../../../models/List");
const SpaceChat = require("../../../models/SpaceChat");
const Card = require("../../../models/Card");
const Checklist = require("../../../models/Checklist");
const CommentChat = require("../../../models/CommentChat");

/**
 * Create a space
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
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
					const amIExistsItThisWorkspace = await Workspace.exists({ $and: [{ _id: workspaceId }, { "teamMembers.member": user._id }] });
					if (amIExistsItThisWorkspace) {
						workspaceIdOk = true;
					} else {
						issue.workspaceId = "You have no access in this workspace!";
					}
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
			name = String(name)
				.replace(/\r?\n|\r/g, "")
				.replace(/  +/g, " ")
				.trim();
			const validName = name.match(letters);
			if (validName) {
				const duplicateSpace = await Space.exists({ $and: [{ workSpaceRef: isValidObjectId(workspaceId) ? workspaceId : undefined }, { name: new RegExp(`^${name}$`, "i") }] });
				if (!duplicateSpace) {
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

		// privacy check
		if (privacy) {
			privacy = String(privacy).toLowerCase().trim();
			if (["public", "private"].includes(privacy)) {
				privacyOk = true;
			} else {
				issue.privacy = "Invalid privacy keyword!";
			}
		} else {
			privacy = undefined;
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
			saveSpace.members = undefined;

			res.status(201).json({ space: saveSpace });

			// initial or default Board create
			const boardStructures = [];
			let orderNumber = 1;
			for (const board of defaultBoards) {
				if (board) {
					boardStructures.push({
						name: board,
						spaceRef: saveSpace._id,
						creator: user._id,
						order: orderNumber,
					});
					orderNumber++;
				}
			}
			if (boardStructures.length) {
				await List.create(boardStructures);
			}
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

/**
 * Get spaces list under a workspace
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.getSpaces = async (req, res, next) => {
	let { workspaceId, search: searchKeyWord, limit, skip } = req.query;
	try {
		limit = parseInt(limit) || 20;
		skip = parseInt(skip) || 0;
		const user = req.user;
		const issue = {};

		if (workspaceId) {
			if (isValidObjectId(workspaceId)) {
				const existsWorkspace = await Workspace.exists({ _id: workspaceId });
				if (existsWorkspace) {
					const doIHaveAccessInWorkspace = await Workspace.exists({ $and: [{ _id: workspaceId }, { "teamMembers.member": user._id }] });
					if (doIHaveAccessInWorkspace) {
						const amIOwnerOfWorkspace = await Workspace.exists({
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

						let searchQuery = {};
						if (searchKeyWord) {
							function es(str) {
								return str.replace(/[-\/\\^$*+?()|[\]{}]/g, "");
							}
							const KeyWordRegExp = new RegExp("^" + es(searchKeyWord), "i"); // Match from starting
							searchQuery = { name: KeyWordRegExp };
						}

						let query = {};
						if (amIOwnerOfWorkspace) {
							// Workspace's owner can see all the spaces of the workspace.
							query = { $and: [{ workSpaceRef: workspaceId }, searchQuery] };
						} else {
							// Workspace's users can see all the public spaces and only the private spaces where the user has been added.
							query = { $and: [{ workSpaceRef: workspaceId }, { $or: [{ "members.member": user._id }, { privacy: "public" }] }, searchQuery] };
						}

						const getSpace = await Space.find(query).sort({ createdAt: -1 }).select("-workSpaceRef").skip(skip).limit(limit);

						return res.json({ spaces: getSpace });
					} else {
						issue.message = "You are not the member of the workspace!";
					}
				} else {
					issue.message = "Not found workspace!";
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
 * Get spaces details under a workspace
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.getSpaceDetails = async (req, res, next) => {
	let { spaceId } = req.params;
	let { skip, limit } = req.query;

	try {
		limit = parseInt(limit) || 20;
		skip = parseInt(skip) || 0;
		const user = req.user;
		const issue = {};

		if (spaceId) {
			if (isValidObjectId(spaceId)) {
				const spaceExists = await Space.findOne({ _id: spaceId }).select("workSpaceRef");
				const workspaceId = spaceExists.workSpaceRef;
				if (spaceExists) {
					const existsWorkspace = await Workspace.exists({ _id: workspaceId });
					if (existsWorkspace) {
						const doIHaveAccessInWorkspace = await Workspace.exists({ $and: [{ _id: workspaceId }, { "teamMembers.member": user._id }] });
						if (doIHaveAccessInWorkspace) {
							const amIOwnerOfWorkspace = await Workspace.exists({
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

							let query = {};
							if (amIOwnerOfWorkspace) {
								// Workspace's owner can see any space of the workspace.
								query = { _id: spaceId };
							} else {
								// Workspace's users can see any public space and only the private space where the user has been added.
								query = { $and: [{ _id: spaceId }, { $or: [{ "members.member": user._id }, { privacy: "public" }] }] };
							}

							const amIMemberOfThisSpace = await Space.exists(query);
							if (amIMemberOfThisSpace) {
								let getSpace = await Space.findOne(
									{ _id: spaceId },
									{
										members: { $slice: [skip, limit] },
									}
								).select("+members");

								getSpace = JSON.parse(JSON.stringify(getSpace));

								const spaceMembers = getSpace.members;
								const members = [];
								for (const single of spaceMembers) {
									members.push(single.member);
								}
								delete getSpace.members;
								getSpace.activeMembers = await User.countDocuments({ $and: [{ _id: { $in: members } }, { socketId: { $ne: null } }] });

								return res.json({ space: getSpace });
							} else {
								issue.message = "You're not a member of this space!";
							}
						} else {
							issue.message = "You are not the member of the workspace of the space!";
						}
					} else {
						issue.message = "Workspace does not exists of this space!";
					}
				} else {
					issue.message = "Space not found";
				}
			} else {
				issue.message = "Invalid space id!";
			}
		} else {
			issue.message = "Please provide space id!";
		}

		return res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};

/**
 * Update space
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.updateSpace = async (req, res, next) => {
	let { name, description, color, privacy } = req.body;
	let { spaceId } = req.params;
	try {
		const user = req.user;
		const issue = {};
		let spaceIdOk, nameOk, descriptionOk, colorOk, privacyOk;

		// check space id
		if (spaceId) {
			if (isValidObjectId(spaceId)) {
				var spaceExists = await Space.findOne({ _id: spaceId }).select("workSpaceRef").populate({
					path: "workSpaceRef",
					select: "_id",
				});

				if (spaceExists) {
					var workSpaceId = spaceExists.workSpaceRef && spaceExists.workSpaceRef._id;
					spaceIdOk = true;
				} else {
					issue.spaceId = "Space not found";
				}
			} else {
				issue.spaceId = "Invalid space id!";
			}
		} else {
			issue.spaceId = "Please provide space id!";
		}

		// name check
		if (name) {
			const letters = /^[A-Za-z0-9\s]+$/;
			name = String(name)
				.replace(/\r?\n|\r/g, "")
				.replace(/  +/g, " ")
				.trim();
			const validName = name.match(letters);
			if (validName) {
				if (spaceExists) {
					const duplicateSpace = await Space.exists({ $and: [{ workSpaceRef: workSpaceId }, { _id: { $ne: spaceId } }, { name: new RegExp(`^${name}$`, "i") }] });
					if (!duplicateSpace) {
						nameOk = true;
					} else {
						issue.name = "Duplicate space name!";
					}
				}
			} else {
				issue.name = "Space name is not valid!";
			}
		} else {
			nameOk = true;
		}

		// description check
		if (description) {
			description = String(description)
				.replace(/\r?\n|\r/g, "")
				.replace(/  +/g, " ")
				.trim();
			description = String(description).replace(/  +/g, " ").trim();
			descriptionOk = true;
		} else {
			descriptionOk = true;
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

		if (spaceIdOk && nameOk && descriptionOk && colorOk && privacyOk) {
			if (workSpaceId) {
				const iAMAdminOfSpaceOfWorkspace = await Workspace.exists({
					$and: [
						{ _id: workSpaceId },
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
				const iAMManagerOfTheSpace = await Space.exists({ $and: [{ _id: spaceId }, { members: { $elemMatch: { member: user._id, role: "manager" } } }] });

				if (iAMAdminOfSpaceOfWorkspace || iAMManagerOfTheSpace) {
					const updateSpace = await Space.updateOne(
						{ _id: spaceId },
						{
							name,
							description,
							privacy,
							color,
						}
					);

					if (updateSpace.modifiedCount) {
						return res.json({ message: "Successfully updated" });
					} else {
						issue.space = "Failed to updated!";
					}
				} else {
					issue.message = "You have no access to perform this operation!";
				}
			} else {
				issue.message = "Something is wrong!";
			}
		}

		return res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};

/**
 * Delete space
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.deleteSpace = async (req, res, next) => {
	let { spaceId } = req.params;
	try {
		const user = req.user;
		const issue = {};

		if (spaceId) {
			if (isValidObjectId(spaceId)) {
				const spaceExists = await Space.findOne({ _id: spaceId }).select("workSpaceRef").populate({
					path: "workSpaceRef",
					select: "_id",
				});

				if (spaceExists) {
					const workSpaceId = spaceExists.workSpaceRef?._id;
					if (workSpaceId) {
						const iAMAdminOfSpaceOfWorkspace = await Workspace.exists({
							$and: [
								{ _id: workSpaceId },
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
						const iAMManagerOfTheSpace = await Space.exists({ $and: [{ _id: spaceExists._id }, { members: { $elemMatch: { member: user._id, role: "manager" } } }] });

						if (iAMAdminOfSpaceOfWorkspace || iAMManagerOfTheSpace) {
							await List.deleteMany({ spaceRef: spaceExists._id });
							await SpaceChat.deleteMany({ to: spaceExists._id });
							await Card.deleteMany({ spaceRef: spaceExists._id });
							await Checklist.deleteMany({ spaceRef: spaceExists._id });
							await CommentChat.deleteMany({ spaceRef: spaceExists._id });
							await Space.deleteOne({ _id: spaceExists._id });

							return res.json({ message: "Successfully deleted the space" });
						} else {
							issue.message = "You have no access to perform this operation!";
						}
					} else {
						issue.message = "Something is wrong!";
					}
				} else {
					issue.spaceId = "Already deleted the Space";
				}
			} else {
				issue.spaceId = "Invalid space id!";
			}
		} else {
			issue.spaceId = "Please provide space id!";
		}

		return res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};

/**
 * Add members to a space
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.addMembers = async (req, res, next) => {
	let { spaceId } = req.params;
	let { memberId } = req.body;

	try {
		const user = req.user;
		const issue = {};

		if (spaceId) {
			if (isValidObjectId(spaceId)) {
				const spaceExists = await Space.findOne({ _id: spaceId }).select("workSpaceRef").populate({
					path: "workSpaceRef",
					select: "_id",
				});
				if (spaceExists) {
					if (spaceExists.workSpaceRef) {
						const workSpaceRef = spaceExists.workSpaceRef._id;
						const iAMAdminOfSpaceOfWorkspace = await Workspace.exists({
							$and: [
								{ _id: workSpaceRef },
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
						const iAMManagerOfTheSpace = await Space.exists({ $and: [{ _id: spaceId }, { members: { $elemMatch: { member: user._id, role: "manager" } } }] });
						if (iAMAdminOfSpaceOfWorkspace || iAMManagerOfTheSpace) {
							if (memberId) {
								if (isValidObjectId(memberId)) {
									const memberExists = await User.exists({ _id: memberId });
									if (memberExists) {
										const alreadyMember = await await Space.exists({ $and: [{ _id: spaceId }, { "members.member": memberId }] });
										if (!alreadyMember) {
											const memberPush = await Space.updateOne(
												{ _id: spaceId },
												{
													$push: {
														members: {
															member: memberId,
														},
													},
												}
											);

											if (memberPush.modifiedCount) {
												// also add the member to the Workspace as a Team Member
												const allReadyExistsInWorkspace = await Workspace.exists({ $and: [{ _id: workSpaceRef }, { "teamMembers.member": memberId }] });
												if (!allReadyExistsInWorkspace) {
													await Workspace.updateOne(
														{ _id: workSpaceRef },
														{
															$push: {
																teamMembers: {
																	member: memberId,
																},
															},
														}
													);
												}

												return res.json({ message: "Successfully added the member to the space!" });
											} else {
												issue.message = "Failed to add member!";
											}
										} else {
											issue.message = "Already added this member to the space!";
										}
									} else {
										issue.message = "Member not found!";
									}
								} else {
									issue.message = "Invalid member id!";
								}
							} else {
								issue.message = "Please provide member id!";
							}
						} else {
							issue.message = "You have no access to perform this operation!";
						}
					} else {
						issue.message = "Something is wrong!";
					}
				} else {
					issue.message = "Space not found";
				}
			} else {
				issue.message = "Invalid space id!";
			}
		} else {
			issue.message = "Please provide space id!";
		}

		return res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};

/**
 * Remove members from a space
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.removeMembers = async (req, res, next) => {
	let { spaceId } = req.params;
	let { memberId } = req.body;

	try {
		const user = req.user;
		const issue = {};

		if (spaceId) {
			if (isValidObjectId(spaceId)) {
				const spaceExists = await Space.findOne({ _id: spaceId }).select("workSpaceRef").populate({
					path: "workSpaceRef",
					select: "_id",
				});
				if (spaceExists) {
					if (spaceExists.workSpaceRef) {
						const workSpaceRef = spaceExists.workSpaceRef._id;

						const iAMAdminOfSpaceOfWorkspace = await Workspace.exists({
							$and: [
								{ _id: workSpaceRef },
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

						const iAMManagerOfTheSpace = await Space.exists({ $and: [{ _id: spaceId }, { members: { $elemMatch: { member: user._id, role: "manager" } } }] });
						if (iAMAdminOfSpaceOfWorkspace || iAMManagerOfTheSpace) {
							if (memberId) {
								if (isValidObjectId(memberId)) {
									const memberExistsInSpace = await await Space.exists({ $and: [{ _id: spaceId }, { "members.member": memberId }] });
									if (memberExistsInSpace) {
										const memberPush = await Space.updateOne(
											{ _id: spaceId },
											{
												$pull: {
													members: {
														member: memberId,
													},
												},
											}
										);

										if (memberPush.modifiedCount) {
											return res.json({ message: "Successfully removed the member from the space!" });
										} else {
											issue.message = "Failed to add member!";
										}
									} else {
										issue.message = "Already removed this member from the space!";
									}
								} else {
									issue.message = "Invalid member id!";
								}
							} else {
								issue.message = "Please provide member id!";
							}
						} else {
							issue.message = "You have no access to perform this operation!";
						}
					} else {
						issue.message = "Something is wrong!";
					}
				} else {
					issue.message = "Space not found";
				}
			} else {
				issue.message = "Invalid space id!";
			}
		} else {
			issue.message = "Please provide space id!";
		}

		return res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};

/**
 * Get members list of a space
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.getMembers = async (req, res, next) => {
	let { spaceId } = req.params;
	let { skip, limit } = req.query;

	try {
		limit = parseInt(limit) || 20;
		skip = parseInt(skip) || 0;
		const user = req.user;
		const issue = {};

		if (spaceId) {
			if (isValidObjectId(spaceId)) {
				const spaceExists = await Space.exists({ _id: spaceId });
				if (spaceExists) {
					const amIMemberOfThisSpace = await Space.exists({ $and: [{ _id: spaceId }, { "members.member": user._id }] });
					if (amIMemberOfThisSpace) {
						const getMembers = await Space.findOne(
							{ _id: spaceId },
							{
								members: { $slice: [skip, limit] },
							}
						)
							.select("+members -name -description -privacy -color -workSpaceRef")
							.populate({
								path: "members",
								populate: {
									path: "member",
									select: "fullName username email avatar",
								},
							});

						const spaceMembers = getMembers.members;
						const members = [];
						for (const single of spaceMembers) {
							if (single.member) {
								const member = JSON.parse(JSON.stringify(single.member));
								member.role = single.role;
								members.push(member);
							}
						}

						return res.json({ members });
					} else {
						issue.message = "You're not a member of this space!";
					}
				} else {
					issue.message = "Space not found";
				}
			} else {
				issue.message = "Invalid space id!";
			}
		} else {
			issue.message = "Please provide space id!";
		}

		return res.status(400).json({ issue });
	} catch (err) {
		next(err);
	}
};
