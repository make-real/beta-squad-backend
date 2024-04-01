const { isValidObjectId } = require("mongoose");
const { imageCheck, upload } = require("../../utils/file");
const { isValidEmail, usernameGenerating } = require("../../utils/func");
const { mailSendWithDynamicTemplate } = require("../../utils/mail");
const { defaultTags, defaultBoards } = require("../../config/centralVariables");
const User = require("../../models/User");
const Workspace = require("../../models/Workspace");
const WorkspaceSetting = require("../../models/WorkspaceSetting");
const ChatHeader = require("../../models/ChatHeader");
const Chat = require("../../models/Chat");
const Space = require("../../models/Space");
const SpaceFile = require("../../models/SpaceFile");
const Call = require("../../models/Call");
const Card = require("../../models/Card");
const Tag = require("../../models/Tag");
const List = require("../../models/List");
const SpaceChat = require("../../models/SpaceChat");
const Checklist = require("../../models/Checklist");
const CommentChat = require("../../models/CommentChat");
const Notification = require("../../models/Notification");
const Subscription = require("../../models/Subscription");

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
		let nameOk, logoOk;

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
			if (req.files && req.files?.logo) {
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
		}

		let subscriptionOk;
		const subscription = await Subscription.exists({ user: user._id });
		if (!subscription) {
			const expiredDate = new Date();
			expiredDate.setDate(expiredDate.getDate() + 7);
			const subscriptionStructure = new Subscription({
				type: "TRIAL_SUB",
				paid: true,
				user: user._id,
				startDate: new Date(),
				expiredDate,
			});

			await subscriptionStructure.save();

			subscriptionOk = true;
		} else {
			const subscription = await Subscription.findOne({ user: user._id, expiredDate: { $gt: new Date() } })
				.select("type paid stop")
				.sort({ createdAt: 1 });

			if (subscription && (subscription.paid || !subscription.stop)) {
				subscriptionOk = true;
			} else {
				issue.message = "Subscription Required!";
			}
		}

		if (nameOk && logoOk && subscriptionOk) {
			const workspaceStructure = new Workspace({
				name,
				owner: user._id,
				logo: logoUrl,
				teamMembers: [
					{
						member: user._id,
						role: "owner",
					},
				],
			});

			const saveWorkspace = await workspaceStructure.save();

			// Workspace Setting create for this user
			const workspaceSettingStructure = new WorkspaceSetting({
				workSpace: saveWorkspace._id,
				user: user._id,
			});
			await workspaceSettingStructure.save();

			const workspace = {
				_id: saveWorkspace._id,
				name: saveWorkspace.name,
				logo: saveWorkspace.logo,
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

				// initial or default Board create
				const boardStructures = [];
				let orderNumber = 1;
				for (const board of defaultBoards) {
					if (board) {
						boardStructures.push({
							name: board,
							spaceRef: initialSpace._id,
							creator: user._id,
							order: orderNumber,
						});
						orderNumber++;
					}
				}
				if (boardStructures.length) {
					await List.create(boardStructures);
				}

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
					},
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
 * Delete workspace
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.deleteWorkspace = async (req, res, next) => {
	let { workspaceId } = req.params;

	try {
		const user = req.user;
		const issue = {};

		// check workspace id
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
						const deleteSpace = await Workspace.deleteOne({ _id: workspaceId });
						if (deleteSpace.deletedCount) {
							res.json({ message: "Successfully deleted the workspace" });

							await WorkspaceSetting.deleteMany({ workSpace: workspaceId });

							const findSpaces = await Space.find({ workSpaceRef: workspaceId }).select("_id");
							for (const space of findSpaces) {
								await List.deleteMany({ spaceRef: space._id });
								await SpaceChat.deleteMany({ to: space._id });
								await SpaceFile.deleteMany({ spaceRef: space._id });
								await Call.deleteMany({ space: space._id });
								await Card.deleteMany({ spaceRef: space._id });
								await Checklist.deleteMany({ spaceRef: space._id });
								await CommentChat.deleteMany({ spaceRef: space._id });
							}
							await Tag.deleteMany({ workSpaceRef: workspaceId });
							await Space.deleteMany({ workSpaceRef: workspaceId });
							const chatHeaderIds = await ChatHeader.find({ workSpaceRef: workspaceId }).distinct("_id");
							await ChatHeader.deleteMany({ workSpaceRef: workspaceId });
							await Chat.deleteMany({ chatHeaderRef: chatHeaderIds });
						} else {
							issue.space = "Failed to delete!";
						}
					} else {
						issue.workspaceId = "You have no rights to delete the Workspace!";
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

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
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
	let { userEmail, designation, guest } = req.body;

	try {
		const user = req.user;
		const issue = {};

		if (workspaceId) {
			if (isValidObjectId(workspaceId)) {
				const workspaceExists = await Workspace.findOne({ _id: workspaceId }).select("name");
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
							let userExists = await User.findOne({ email: userEmail }).select("_id fullName email");
							if (!userExists && guest) {
								const guestUser = new User({
									fullName: "Guest",
									email: userEmail,
									username: await usernameGenerating(userEmail),
									guest: true,
								});
								userExists = await guestUser.save();
							}
							if (userExists) {
								const allReadyExistsInWorkspace = await Workspace.exists({ $and: [{ _id: workspaceId }, { "teamMembers.member": userExists._id }] });
								if (!allReadyExistsInWorkspace) {
									const pushTeamMembersInWorkspace = await Workspace.updateOne(
										{ _id: workspaceId },
										{
											$push: {
												teamMembers: {
													member: userExists._id,
													role: guest ? "guest" : "user",
													designation: designation || undefined,
												},
											},
										},
									);

									// Workspace Setting create for this user
									const workspaceSettingStructure = new WorkspaceSetting({
										workSpace: workspaceId,
										user: userExists._id,
									});
									await workspaceSettingStructure.save();

									if (pushTeamMembersInWorkspace.modifiedCount) {
										// notification creating for user about adding in workspace
										const notificationStructure = new Notification({
											user: userExists._id,
											message: `${user.fullName} added you in workspace ${workspaceExists.name}`,
										});
										await notificationStructure.save();

										global.io.to(String(userExists.socketId)).emit("NEW_NOTIFICATION_RECEIVED", notificationStructure.message);

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
													},
												);
											}
										}

										res.json({ message: "Successfully added the user to the workspace as a team member!" });

										const dynamicTemplateData = {
											name: userExists.fullName,
											addedBy: user.fullName,
											workspaceName: workspaceExists.name,
											directLink: "undefined",
										};
										mailSendWithDynamicTemplate(userExists.email, process.env.TEMPLATE_ID_MEMBER_ADD_IN_WORKSPACE, dynamicTemplateData);
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

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

/**
 * Get team members list of a workspace
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.teamMembers = async (req, res, next) => {
	let { workspaceId } = req.params;

	try {
		const user = req.user;
		const issue = {};

		if (workspaceId) {
			if (isValidObjectId(workspaceId)) {
				const workspaceExists = await Workspace.exists({ _id: workspaceId });
				if (workspaceExists) {
					const getWorkspace = await Workspace.findOne({ $and: [{ _id: workspaceId }, { "teamMembers.member": user._id }] })
						.select("teamMembers")
						.populate({
							path: "teamMembers.member",
							select: "fullName username email avatar",
						});
					if (getWorkspace) {
						let teamMembers = getWorkspace.teamMembers;
						teamMembers = JSON.parse(JSON.stringify(teamMembers));
						const members = [];
						for (const singleItem of teamMembers) {
							if (singleItem.member) {
								members.push({
									...singleItem.member,
									role: singleItem.role,
									designation: singleItem.designation,
								});
							}
						}

						return res.json({ teamMembers: members });
					} else {
						issue.message = "You have no access in this workspace!";
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
 * Team member data update in Workspace
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.teamMemberDataUpdateInWorkspace = async (req, res, next) => {
	let { workspaceId } = req.params;
	let { memberId } = req.params;
	let { designation } = req.body;

	try {
		const user = req.user;
		const issue = {};

		if (workspaceId) {
			if (isValidObjectId(workspaceId)) {
				if (designation) {
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
											await Workspace.updateOne(
												{
													$and: [{ _id: workspaceId }, { "teamMembers.member": memberId }],
												},
												{ $set: { "teamMembers.$.designation": designation } },
											);

											return res.json({ message: `Successfully updated designation of the member` });
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
					issue.designation = "Please provide designation!";
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
}; /**


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
				if (["admin", "user", "guest", "remove"].includes(requestFor)) {
					const workspaceExists = await Workspace.findOne({ _id: workspaceId }).select("name");
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
								const userExists = await User.findOne({ _id: memberId }).select("_id fullName email");
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
													{ $set: { "teamMembers.$.role": requestFor } },
												);

												res.json({ message: `Successfully role changed to ${requestFor}` });

												// mail sending to the member whose role has been changed
												const dynamicTemplateData = {
													name: userExists.fullName,
													updatedBy: user.fullName,
													role: requestFor,
													workspaceName: workspaceExists.name,
												};
												mailSendWithDynamicTemplate(userExists.email, process.env.TEMPLATE_ID_MEMBER_WORKSPACE_ROLE_CHANGE, dynamicTemplateData);

												// notification creating for the member whose role has been changed
												const notificationStructure = new Notification({
													user: userExists._id,
													message: `${user.fullName} has updated your role to ${requestFor} in ${workspaceExists.name} workspace`,
												});
												notificationStructure.save();

												global.io.to(String(userExists.socketId)).emit("NEW_NOTIFICATION_RECEIVED", notificationStructure.message);
											} else {
												await Workspace.updateOne(
													{ _id: workspaceId },
													{
														$pull: {
															teamMembers: {
																member: memberId,
															},
														},
													},
												);

												await WorkspaceSetting.deleteOne({ $and: [{ workSpace: workspaceId }, { user: memberId }] });

												// also remove the member from the spaces of the Workspace
												await Space.updateOne(
													{ $and: [{ workSpaceRef: workspaceId }, { "members.member": memberId }] },
													{
														$pull: {
															members: {
																member: memberId,
															},
														},
													},
												);

												res.json({ message: "Successfully remove member from the workspace" });
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
						issue.message = `Invalid keyword!- only valid keywords are: "admin", "user", "guest", "remove"`;
					}
				}
			} else {
				issue.message = "Invalid workspace id!";
			}
		} else {
			issue.message = "Please provide workspace id!";
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
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
										{ $set: { "teamMembers.$.role": "owner" } },
									);

									await Workspace.updateOne(
										{
											$and: [{ _id: workspaceId }, { "teamMembers.member": user._id }],
										},
										{ $set: { "teamMembers.$.role": "user" } },
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
 * Leave from workspace
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.leaveFromWorkspace = async (req, res, next) => {
	let { workspaceId } = req.params;

	try {
		const user = req.user;
		const issue = {};

		if (workspaceId) {
			if (isValidObjectId(workspaceId)) {
				const workspaceExists = await Workspace.exists({ _id: workspaceId });
				if (workspaceExists) {
					const amIExistsInWorkspace = await Workspace.exists({ $and: [{ _id: workspaceId }, { "teamMembers.member": user._id }] });
					if (amIExistsInWorkspace) {
						// Leave from workspace
						await Workspace.updateOne(
							{ _id: workspaceId },
							{
								$pull: {
									teamMembers: {
										member: user._id,
									},
								},
							},
						);

						await WorkspaceSetting.deleteOne({ $and: [{ workSpace: workspaceId }, { user: user._id }] });

						// Also leave from the spaces of the Workspace
						await Space.updateOne(
							{ $and: [{ workSpaceRef: workspaceId }, { "members.member": user._id }] },
							{
								$pull: {
									members: {
										member: user._id,
									},
								},
							},
						);

						return res.json({ message: "Successfully left from the workplace" });
					} else {
						issue.message = "You already leave from the workspace!";
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
 * User's own settings update in workspace
 *
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {() => } next Express callback
 */
exports.settingsUpdate = async (req, res, next) => {
	let { workspaceId } = req.params;
	let { popUpNotification, emailNotification, soundNotification, pushNotification } = req.body;

	try {
		const user = req.user;
		const issue = {};

		if (workspaceId) {
			if (isValidObjectId(workspaceId)) {
				const workspaceExists = await Workspace.exists({ _id: workspaceId });
				if (workspaceExists) {
					const amIExistsInWorkspace = await Workspace.exists({ $and: [{ _id: workspaceId }, { "teamMembers.member": user._id }] });
					if (amIExistsInWorkspace) {
						const findWorkspaceSetting = await WorkspaceSetting.findOne({ $and: [{ workSpace: workspaceId }, { user: user._id }] });

						let updatedSettings;
						if (findWorkspaceSetting) {
							let notificationDeliverySettings = findWorkspaceSetting.notificationDeliverySettings;

							const notificationSettings = {
								...notificationDeliverySettings,
								popUpNotification: popUpNotification === true || popUpNotification === false ? popUpNotification : notificationDeliverySettings.popUpNotification,
								emailNotification: emailNotification === true || emailNotification === false ? emailNotification : notificationDeliverySettings.emailNotification,
								soundNotification: soundNotification === true || soundNotification === false ? soundNotification : notificationDeliverySettings.soundNotification,
								pushNotification: pushNotification === true || pushNotification === false ? pushNotification : notificationDeliverySettings.pushNotification,
							};
							await WorkspaceSetting.updateOne({ _id: findWorkspaceSetting._id }, { notificationDeliverySettings: notificationSettings });

							updatedSettings = {
								notificationDeliverySettings: notificationSettings,
							};
						} else {
							// Workspace Setting create for this user
							const workspaceSettingStructure = new WorkspaceSetting({
								workSpace: workspaceId,
								user: user._id,
							});
							const create = await workspaceSettingStructure.save();

							updatedSettings = {
								notificationDeliverySettings: create.notificationDeliverySettings,
							};
						}

						return res.json({ message: "Successfully updated", updatedSettings });
					} else {
						issue.message = "You are not member of the workspace!";
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

exports.getSettings = async (req, res, next) => {
	let { workspaceId } = req.params;

	try {
		const user = req.user;
		const issue = {};

		if (workspaceId) {
			if (isValidObjectId(workspaceId)) {
				const workspaceExists = await Workspace.exists({ _id: workspaceId });
				if (workspaceExists) {
					const amIExistsInWorkspace = await Workspace.exists({ $and: [{ _id: workspaceId }, { "teamMembers.member": user._id }] });
					if (amIExistsInWorkspace) {
						let workspaceSettings = await WorkspaceSetting.findOne({ $and: [{ workSpace: workspaceId }, { user: user._id }] });

						if (!workspaceSettings) {
							// Workspace Setting create for this user
							const workspaceSettingStructure = new WorkspaceSetting({
								workSpace: workspaceId,
								user: user._id,
							});
							workspaceSettings = await workspaceSettingStructure.save();
						}

						return res.json({ workspaceSettings });
					} else {
						issue.message = "You are not member of the workspace!";
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
