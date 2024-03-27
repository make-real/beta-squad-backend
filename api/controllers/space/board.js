const { isValidObjectId, Types } = require("mongoose");
const User = require("../../../models/User");
const Space = require("../../../models/Space");
const Workspace = require("../../../models/Workspace");
const List = require("../../../models/List");
const Card = require("../../../models/Card");
const Checklist = require("../../../models/Checklist");
const CommentChat = require("../../../models/CommentChat");
const Tag = require("../../../models/Tag");
const Notification = require("../../../models/Notification");
const { multipleFilesCheckAndUpload } = require("../../../utils/file");
const { isValidEmail, usernameGenerating, splitSpecificParts, hexAColorGen, cardKeyGen } = require("../../../utils/func");
const { mailSendWithDynamicTemplate } = require("../../../utils/mail");

exports.createList = async (req, res, next) => {
	let { spaceId } = req.params;
	let { name } = req.body;
	try {
		const user = req.user;
		const issue = {};

		if (name) {
			name = String(name)
				.replace(/\r\n/g, " ")
				.replace(/[\r\n]/g, " ")
				.replace(/  +/g, " ")
				.trim();

			if (isValidObjectId(spaceId)) {
				const existsSpace = await Space.exists({ _id: spaceId });
				if (existsSpace) {
					const doIHaveAccess = await Space.exists({ $and: [{ _id: spaceId }, { "members.member": user._id }] });
					if (doIHaveAccess) {
						const isDuplicate = await List.exists({ $and: [{ spaceRef: spaceId }, { name: new RegExp(`^${name}$`, "i") }] });
						if (!isDuplicate) {
							// generate List order number
							let orderNumber;
							const existsCard = await List.exists({ $and: [{ spaceRef: spaceId }, { order: 1 }] });
							if (existsCard) {
								const highest = await List.findOne({ spaceRef: spaceId }).sort({ order: -1 }).select("order");
								orderNumber = highest.order + 1;
							} else {
								orderNumber = 1;
							}

							const listStructure = new List({
								name,
								spaceRef: spaceId,
								creator: user._id,
								order: orderNumber,
							});
							const createList = await listStructure.save();

							createList.creator = undefined;
							res.status(201).json({ list: createList });
						} else {
							issue.message = "Couldn't create a duplicate list in the same space!";
						}
					} else {
						issue.message = "You have no access to this space!";
					}
				} else {
					issue.message = "Not found space!";
				}
			} else {
				issue.message = "Invalid space id!";
			}
		} else {
			issue.message = "Please provide a name to create a list!";
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

exports.getLists = async (req, res, next) => {
	let { spaceId } = req.params;
	let { skip, limit, getCards } = req.query;
	try {
		limit = parseInt(limit) || 50;
		skip = parseInt(skip) || 0;
		const user = req.user;
		const issue = {};

		if (isValidObjectId(spaceId)) {
			const existsSpace = await Space.exists({ _id: spaceId });
			if (existsSpace) {
				const doIHaveAccess = await Space.exists({ $and: [{ _id: spaceId }, { "members.member": user._id }] });
				if (doIHaveAccess) {
					const pipeline = [
						{ $match: { spaceRef: Types.ObjectId(spaceId) } },
						{
							$skip: skip,
						},
						{
							$limit: limit,
						},
						{
							$project: {
								name: 1,
								order: 1,
							},
						},
					];

					if (getCards) {
						pipeline.push({
							$lookup: {
								from: "cards",
								localField: "_id",
								foreignField: "listRef",
								as: "cards",
								pipeline: [
									{
										$sort: { order: 1 },
									},
									{
										$lookup: {
											from: "tags",
											localField: "tags",
											foreignField: "_id",
											as: "tags",
											pipeline: [{ $project: { name: 1, color: 1 } }],
										},
									},
									{
										$lookup: {
											from: "checklists",
											localField: "checkList",
											foreignField: "_id",
											as: "checkList",
											pipeline: [{ $project: { content: 1, checked: 1, spaceRef: 1, cardRef: 1 } }],
										},
									},
									{
										$lookup: {
											from: "users",
											localField: "assignee",
											foreignField: "_id",
											as: "assignee",
											pipeline: [{ $project: { fullName: 1, username: 1, avatar: 1 } }],
										},
									},
									{
										$lookup: {
											from: "commentchats",
											localField: "_id",
											foreignField: "to",
											as: "commentchats",
											pipeline: [{ $project: { _id: 1 } }],
										},
									},
									{
										$project: {
											name: 1,
											progress: 1,
											description: 1,
											tags: 1,
											checkList: 1,
											assignee: 1,
											startDate: 1,
											endDate: 1,
											order: 1,
											spaceRef: 1,
											listRef: 1,
											color: 1,
											cardKey: 1,
											createdAt: 1,
											updatedAt: 1,
											commentsCount: { $size: "$commentchats" },
											attachmentsCount: { $size: "$attachments" },
											seen: {
												$cond: {
													if: { $in: [user._id, "$seenBy"] },
													then: true,
													else: false,
												},
											},
										},
									},
								],
							},
						});
					}

					let getLists = await List.aggregate(pipeline).sort({ order: 1 });

					res.json({ lists: getLists });
				} else {
					issue.message = "You have no access to this space!";
				}
			} else {
				issue.message = "Not found space!";
			}
		} else {
			issue.message = "Invalid space id!";
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

exports.editList = async (req, res, next) => {
	let { spaceId, listId } = req.params;
	let { name } = req.body;
	try {
		const user = req.user;
		const issue = {};

		if (name) {
			name = String(name)
				.replace(/\r\n/g, " ")
				.replace(/[\r\n]/g, " ")
				.replace(/  +/g, " ")
				.trim();

			const isValidSpaceId = isValidObjectId(spaceId);
			const isValidListId = isValidObjectId(listId);
			if (isValidSpaceId && isValidListId) {
				const existsList = await List.findOne({ _id: listId }).select("spaceRef");
				if (existsList) {
					const existsSpace = await Space.exists({ _id: existsList.spaceRef });
					if (existsSpace) {
						const doIHaveAccess = await Space.exists({ $and: [{ _id: existsList.spaceRef }, { "members.member": user._id }] });
						if (doIHaveAccess) {
							const updateList = await List.updateOne({ _id: listId }, { name });

							if (updateList.modifiedCount) {
								res.json({ message: "Successfully updated name!" });
							} else {
								issue.message = "Failed to update!";
							}
						} else {
							issue.message = "You have no access to this space of the list!";
						}
					} else {
						issue.message = "Not found space!";
					}
				} else {
					issue.message = "Not found the list!";
				}
			} else {
				if (!isValidSpaceId) {
					issue.message = "Invalid space id!";
				} else if (!isValidListId) {
					issue.message = "Invalid list id!";
				}
			}
		} else {
			issue.message = "Please provide a name to update list name!";
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};
exports.deleteList = async (req, res, next) => {
	let { spaceId, listId } = req.params;

	try {
		const user = req.user;
		const issue = {};

		const isValidSpaceId = isValidObjectId(spaceId);
		const isValidListId = isValidObjectId(listId);
		if (isValidSpaceId && isValidListId) {
			const existsList = await List.findOne({ _id: listId }).select("spaceRef order");
			if (existsList) {
				const existsSpace = await Space.exists({ _id: existsList.spaceRef });
				if (existsSpace) {
					const doIHaveAccess = await Space.exists({ $and: [{ _id: existsList.spaceRef }, { "members.member": user._id }] });
					if (doIHaveAccess) {
						const deleteList = await List.deleteOne({ _id: listId });

						if (deleteList.deletedCount) {
							res.json({ message: "Successfully deleted!" });

							/****  START: lists order number rearrange ****/
							const lists = await List.find({ $and: [{ order: { $gte: existsList.order } }, { spaceRef: existsList.spaceRef }] })
								.sort({ order: 1 })
								.select("_id");
							let order = existsList.order;
							for (const list of lists) {
								await List.updateOne(
									{ _id: list._id },
									{
										order,
									},
								);
								order = order + 1;
							}
							/****  END: lists order number rearrange ****/

							const findCard = await Card.find({ listRef: listId }).select("_id");
							for (const card of findCard) {
								await Checklist.deleteMany({ cardRef: card._id });
								await CommentChat.deleteMany({ to: card._id });
							}
							await Card.deleteMany({ listRef: listId });
						} else {
							issue.message = "Failed to delete!";
						}
					} else {
						issue.message = "You have no access to this space of the list!";
					}
				} else {
					issue.message = "Not found space!";
				}
			} else {
				issue.message = "Not found the list!";
			}
		} else {
			if (!isValidSpaceId) {
				issue.message = "Invalid space id!";
			} else if (!isValidListId) {
				issue.message = "Invalid list id!";
			}
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

exports.orderOrSortList = async (req, res, next) => {
	let { spaceId, listId } = req.params;
	let { order } = req.body;

	try {
		let orderOk;
		const user = req.user;
		const issue = {};

		const isValidSpaceId = isValidObjectId(spaceId);
		const isValidListId = isValidObjectId(listId);
		if (isValidSpaceId && isValidListId) {
			const existsList = await List.findOne({ _id: listId }).select("spaceRef order");
			if (existsList) {
				const existsSpace = await Space.exists({ _id: existsList.spaceRef });
				if (existsSpace) {
					const doIHaveAccess = await Space.exists({ $and: [{ _id: existsList.spaceRef }, { "members.member": user._id }] });
					if (doIHaveAccess) {
						// order check
						if (order) {
							order = parseInt(order);
							if (order) {
								if (order > 0) {
									orderOk = true;
								} else {
									issue.order = "Order number number should be greater than 0!";
								}
							} else {
								issue.order = "Invalid order number!";
							}
						} else {
							issue.order = "Please provide order/sorting number!";
						}

						if (orderOk) {
							if (existsList.order < order) {
								/****  START: previous lists order number rearrange ****/
								const lists = await List.find({ $and: [{ order: { $lte: order } }, { _id: { $ne: listId } }, { spaceRef: existsList.spaceRef }] })
									.sort({ order: 1 })
									.select("_id");

								let orderNum = 1;
								for (const list of lists) {
									await List.updateOne(
										{ _id: list._id },
										{
											order: orderNum,
										},
									);
									orderNum = orderNum + 1;
								}
								/****  END: previous lists order number rearrange ****/
							}

							// Update lists order
							await List.updateOne(
								{ _id: listId },
								{
									order,
								},
							);

							const list = await List.findOne({ _id: listId }).select("-createdAt -updatedAt -creator");

							res.json({ updatedList: list });

							if (existsList.order > order) {
								/****  START: next lists order number rearrange ****/
								const lists = await List.find({ $and: [{ order: { $gte: order } }, { _id: { $ne: listId } }, { spaceRef: existsList.spaceRef }] })
									.sort({ order: 1 })
									.select("_id");
								let orderNum = order;
								for (const list of lists) {
									orderNum = orderNum + 1;
									await List.updateOne(
										{ _id: list._id },
										{
											order: orderNum,
										},
									);
								}
								/****  END: next lists order number rearrange ****/
							}

							/****  START: All lists order number rearrange ****/
							const allLists = await List.find({ spaceRef: existsList.spaceRef }).sort({ order: 1 }).select("_id");
							let orderNum = 1;
							for (const list of allLists) {
								await List.updateOne(
									{ _id: list._id },
									{
										order: orderNum,
									},
								);
								orderNum = orderNum + 1;
							}
							/****  END: All lists order number rearrange ****/
						}
					} else {
						issue.message = "You have no access to this space of the list!";
					}
				} else {
					issue.message = "Not found space!";
				}
			} else {
				issue.message = "Not found the list!";
			}
		} else {
			if (!isValidSpaceId) {
				issue.message = "Invalid space id!";
			} else if (!isValidListId) {
				issue.message = "Invalid list id!";
			}
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

/* 
*
*
*
*
CARD 
*
*
*
*
*/
exports.createCard = async (req, res, next) => {
	let { spaceId, listId } = req.params;
	let { name, tagId } = req.body;
	try {
		const user = req.user;
		const issue = {};
		let tagIdOk;

		if (name) {
			name = String(name)
				.replace(/\r\n/g, " ")
				.replace(/[\r\n]/g, " ")
				.replace(/  +/g, " ")
				.trim();

			const isValidSpaceId = isValidObjectId(spaceId);
			const isValidListId = isValidObjectId(listId);
			if (isValidSpaceId && isValidListId) {
				const existsList = await List.findOne({ _id: listId }).select("spaceRef");
				if (existsList) {
					const existsSpace = await Space.findOne({ _id: existsList.spaceRef }).select("workSpaceRef");

					if (existsSpace) {
						// check tagId
						if (tagId) {
							if (isValidObjectId(tagId)) {
								const tagExists = await Tag.exists({ $and: [{ _id: tagId }, { workSpaceRef: existsSpace.workSpaceRef }] });
								if (tagExists) {
									tagIdOk = true;
								} else {
									issue.tagId = "Tag not found!!";
								}
							} else {
								issue.tagId = "Invalid tag id!";
							}
						} else {
							tagId = undefined;
							tagIdOk = true;
						}

						if (tagIdOk) {
							const doIHaveAccess = await Space.exists({ $and: [{ _id: existsList.spaceRef }, { "members.member": user._id }] });
							if (doIHaveAccess) {
								const isDuplicate = await Card.exists({ $and: [{ listRef: listId }, { name: new RegExp(`^${name}$`, "i") }] });
								if (!isDuplicate) {
									// generate order number
									let orderNumber;
									const existsCard = await Card.exists({ $and: [{ listRef: listId }, { order: 1 }] });
									if (existsCard) {
										const highest = await Card.findOne({ listRef: listId }).sort({ order: -1 }).select("order");
										orderNumber = highest.order + 1;
									} else {
										orderNumber = 1;
									}

									const cardStructure = new Card({
										name,
										spaceRef: existsList.spaceRef,
										listRef: listId,
										creator: user._id,
										order: orderNumber,
										color: hexAColorGen(),
										tags: tagId,
										cardKey: await cardKeyGen(existsList.spaceRef),
									});
									const createCard = await cardStructure.save();

									createCard.creator = undefined;
									createCard.attachments = undefined;
									createCard.assignee = undefined;
									createCard.progress = undefined;
									res.status(201).json({ card: createCard });
								} else {
									issue.message = "Couldn't create a card with duplicate name in the same list!";
								}
							} else {
								issue.message = "You have no access to this space!";
							}
						}
					} else {
						issue.message = "Not found space!";
					}
				} else {
					issue.message = "Not found the list!";
				}
			} else {
				if (!isValidSpaceId) {
					issue.message = "Invalid space id!";
				} else if (!isValidListId) {
					issue.message = "Invalid list id!";
				}
			}
		} else {
			issue.message = "Please provide a name to create a card!";
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

exports.getCards = async (req, res, next) => {
	let { spaceId, listId } = req.params;
	let { skip, limit } = req.query;
	try {
		limit = parseInt(limit) || 10;
		skip = parseInt(skip) || 0;

		const user = req.user;
		const issue = {};

		const isValidSpaceId = isValidObjectId(spaceId);
		const isValidListId = isValidObjectId(listId);
		if (isValidSpaceId && isValidListId) {
			const existsList = await List.findOne({ _id: listId }).select("spaceRef");
			if (existsList) {
				const existsSpace = await Space.exists({ _id: existsList.spaceRef });
				if (existsSpace) {
					const doIHaveAccess = await Space.exists({ $and: [{ _id: existsList.spaceRef }, { "members.member": user._id }] });
					if (doIHaveAccess) {
						let getCards = await Card.aggregate([
							{ $match: { listRef: Types.ObjectId(listId) } },
							{
								$sort: { order: 1 },
							},
							{
								$skip: skip,
							},
							{
								$limit: limit,
							},
							{
								$lookup: {
									from: "tags",
									localField: "tags",
									foreignField: "_id",
									as: "tags",
									pipeline: [{ $project: { name: 1, color: 1 } }],
								},
							},
							{
								$lookup: {
									from: "checklists",
									localField: "checkList",
									foreignField: "_id",
									as: "checkList",
									pipeline: [{ $project: { content: 1, checked: 1, spaceRef: 1, cardRef: 1 } }],
								},
							},
							{
								$lookup: {
									from: "users",
									localField: "assignee",
									foreignField: "_id",
									as: "assignee",
									pipeline: [{ $project: { fullName: 1, username: 1, avatar: 1 } }],
								},
							},
							{
								$lookup: {
									from: "commentchats",
									localField: "_id",
									foreignField: "to",
									as: "commentchats",
									pipeline: [{ $project: { _id: 1 } }],
								},
							},
							{
								$project: {
									name: 1,
									progress: 1,
									description: 1,
									tags: 1,
									checkList: 1,
									assignee: 1,
									startDate: 1,
									endDate: 1,
									order: 1,
									spaceRef: 1,
									listRef: 1,
									color: 1,
									cardKey: 1,
									createdAt: 1,
									updatedAt: 1,
									commentsCount: { $size: "$commentchats" },
									attachmentsCount: { $size: "$attachments" },
									seen: {
										$cond: {
											if: { $in: [user._id, "$seenBy"] },
											then: true,
											else: false,
										},
									},
								},
							},
						]);

						return res.json({ cards: getCards });
					} else {
						issue.message = "You have no access to this space!";
					}
				} else {
					issue.message = "Not found space!";
				}
			} else {
				issue.message = "Not found the list!";
			}
		} else {
			if (!isValidSpaceId) {
				issue.message = "Invalid space id!";
			} else if (!isValidListId) {
				issue.message = "Invalid list id!";
			}
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

exports.getSingleCard = async (req, res, next) => {
	let { spaceId, listId, cardId } = req.params;

	try {
		const user = req.user;
		const issue = {};

		const isValidSpaceId = isValidObjectId(spaceId);
		const isValidListId = isValidObjectId(listId);
		const isValidCardId = isValidObjectId(cardId);
		if (isValidSpaceId && isValidListId && isValidCardId) {
			const cardExists = await Card.findOne({ _id: cardId }).select("spaceRef");
			if (cardExists) {
				const existsSpace = await Space.exists({ _id: cardExists.spaceRef });
				if (existsSpace) {
					const doIHaveAccess = await Space.exists({ $and: [{ _id: cardExists.spaceRef }, { "members.member": user._id }] });
					if (doIHaveAccess) {
						let getCard = await Card.aggregate([
							{ $match: { _id: Types.ObjectId(cardId) } },
							{
								$lookup: {
									from: "tags",
									localField: "tags",
									foreignField: "_id",
									as: "tags",
									pipeline: [{ $project: { name: 1, color: 1 } }],
								},
							},
							{
								$lookup: {
									from: "checklists",
									localField: "checkList",
									foreignField: "_id",
									as: "checkList",
									pipeline: [{ $project: { content: 1, checked: 1, spaceRef: 1, cardRef: 1, assignee: 1 } }],
								},
							},
							{
								$lookup: {
									from: "users",
									localField: "assignee",
									foreignField: "_id",
									as: "assignee",
									pipeline: [{ $project: { fullName: 1, username: 1, avatar: 1 } }],
								},
							},
							{
								$lookup: {
									from: "commentchats",
									localField: "_id",
									foreignField: "to",
									as: "commentchats",
									pipeline: [{ $project: { _id: 1 } }],
								},
							},
							{
								$project: {
									name: 1,
									progress: 1,
									description: 1,
									tags: 1,
									checkList: 1,
									assignee: 1,
									startDate: 1,
									endDate: 1,
									order: 1,
									spaceRef: 1,
									listRef: 1,
									color: 1,
									seenBy: 1,
									attachments: 1,
									cardKey: 1,
									createdAt: 1,
									updatedAt: 1,
									commentsCount: { $size: "$commentchats" },
									attachmentsCount: { $size: "$attachments" },
								},
							},
						]);

						// Mark as seen this card for this user
						Card.exists({ $and: [{ _id: cardId }, { seenBy: user._id }] }).then((data) => {
							if (!data) {
								Card.updateOne({ _id: cardId }, { $push: { seenBy: user._id } }).then();
							}
						});

						return res.json({ card: getCard[0] });
					} else {
						issue.spaceId = "You have no access to this space!";
					}
				} else {
					issue.spaceId = "Not found space!";
				}
			} else {
				issue.cardId = "Not found card!";
			}
		} else {
			if (!isValidSpaceId) {
				issue.spaceId = "Invalid space id!";
			} else if (!isValidListId) {
				issue.listId = "Invalid list id!";
			} else if (!isValidCardId) {
				issue.cardId = "Invalid card id!";
			}
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

exports.updateCard = async (req, res, next) => {
	let { spaceId, listId, cardId } = req.params;
	let { name, description, progress, tagId, startDate, endDate, assignUser, removeAssignedUser, removeAttachmentUrl, removeTagId } = req.body;

	try {
		let nameOk, descriptionOk, progressOk, tagIdOk, startDateOk, endDateOk, assignUserOk, removeAssignedUserOk, removeTagIdOk;
		const user = req.user;
		const issue = {};

		const isValidSpaceId = isValidObjectId(spaceId);
		const isValidListId = isValidObjectId(listId);
		const isValidCardId = isValidObjectId(cardId);
		if (isValidSpaceId && isValidListId && isValidCardId) {
			const cardExists = await Card.findOne({ _id: cardId }).select("startDate spaceRef");
			if (cardExists) {
				const existsSpace = await Space.findOne({ _id: cardExists.spaceRef }).select("workSpaceRef");
				if (existsSpace) {
					const doIHaveAccess = await Space.exists({ $and: [{ _id: cardExists.spaceRef }, { "members.member": user._id }] });
					if (doIHaveAccess) {
						// check card name
						if (name) {
							name = String(name)
								.replace(/\r\n/g, " ")
								.replace(/[\r\n]/g, " ")
								.replace(/  +/g, " ")
								.trim();

							nameOk = true;
						} else {
							name = undefined;
							nameOk = true;
						}

						// check description
						if (description) {
							description = String(description).replace(/  +/g, " ").trim();
							descriptionOk = true;
						} else {
							description = undefined;
							descriptionOk = true;
						}

						// check progress number
						if (progress != undefined) {
							if (String(parseInt(progress, 10)) != "NaN") {
								progress = parseInt(progress, 10);
								if (progress >= 0 && progress <= 100) {
									progressOk = true;
								} else {
									issue.message = "Progress number can not be less than 0 and greater than 100!";
								}
							} else {
								issue.message = "Invalid progress number!";
							}
						} else {
							progress = undefined;
							progressOk = true;
						}

						// check tagId
						if (tagId) {
							if (isValidObjectId(tagId)) {
								const tagExists = await Tag.exists({ $and: [{ _id: tagId }, { workSpaceRef: existsSpace.workSpaceRef }] });
								if (tagExists) {
									const tagAlreadyInserted = await Card.exists({ $and: [{ _id: cardId }, { tags: tagId }] });
									if (!tagAlreadyInserted) {
										tagIdOk = true;
									} else {
										issue.tagId = "The tag is already added!";
									}
								} else {
									issue.tagId = "Tag not found!!";
								}
							} else {
								issue.tagId = "Invalid tag id!";
							}
						} else {
							tagId = undefined;
							tagIdOk = true;
						}

						// check startDate
						if (startDate) {
							if (String(Number(startDate)) !== "NaN") {
								startDate = Number(startDate);
							}
							const validTimestamp = new Date(startDate).getTime() > 0;
							if (validTimestamp) {
								startDate = new Date(startDate);
								startDateOk = true;
							} else {
								issue.startDate = "Please provide the valid timestamp of start date!";
							}
						} else {
							startDate = undefined;
							startDateOk = true;
						}

						// check endDate
						if (endDate) {
							if (String(Number(endDate)) !== "NaN") {
								endDate = Number(endDate);
							}
							const validTimestamp = new Date(endDate).getTime() > 0;
							if (validTimestamp) {
								endDate = new Date(endDate);
								if (startDate && startDateOk) {
									if (endDate > startDate) {
										endDateOk = true;
									} else {
										issue.endDate = "End time should be greater than start time!";
									}
								} else {
									if (cardExists.startDate) {
										if (endDate > cardExists.startDate) {
											endDateOk = true;
										} else {
											issue.endDate = "End time should be greater than start time!";
										}
									} else {
										endDateOk = true;
									}
								}
							} else {
								issue.endDate = "Please provide the valid timestamp of end date!";
							}
						} else {
							endDate = undefined;
							endDateOk = true;
						}

						// assign user check
						if (assignUser) {
							const imIOwnerOfTheWorkspace = await Workspace.findOne({
								$and: [
									{ _id: existsSpace.workSpaceRef },
									{
										teamMembers: {
											$elemMatch: {
												member: user._id,
												role: "owner",
											},
										},
									},
								],
							}).select("_id");
							const isValidAssignUserId = isValidObjectId(assignUser);
							if (isValidAssignUserId || isValidEmail(assignUser)) {
								var assignUserData;
								if (isValidAssignUserId) {
									assignUserData = await User.findOne({ _id: assignUser }).select("_id fullName email guest");
								} else if (isValidEmail(assignUser)) {
									assignUser = String(assignUser).toLowerCase();
									assignUserData = await User.findOne({ email: assignUser }).select("_id fullName email guest");

									if (!assignUserData) {
										const guestUser = new User({
											fullName: "Guest",
											email: assignUser,
											username: await usernameGenerating(assignUser),
											guest: true,
										});
										assignUserData = await guestUser.save();
									}
								}

								if (assignUserData) {
									assignUser = assignUserData._id;
									if (!assignUserData.guest || imIOwnerOfTheWorkspace) {
										const assignUserExistsInSpace = await Space.exists({ $and: [{ _id: cardExists.spaceRef }, { "members.member": assignUser }] });
										if (!assignUserExistsInSpace) {
											const assignUserExistsInWorkspace = await Workspace.exists({ $and: [{ _id: existsSpace.workSpaceRef }, { "teamMembers.member": assignUser }] });
											if (!assignUserExistsInWorkspace) {
												// User push in Workspace
												await Workspace.updateOne(
													{ _id: existsSpace.workSpaceRef },
													{
														$push: {
															teamMembers: {
																member: assignUser,
															},
														},
													},
												);
											}

											// Members push in space
											await Space.updateOne(
												{ _id: cardExists.spaceRef },
												{
													$push: {
														members: {
															member: assignUser,
														},
													},
												},
											);
										}

										const theUserAlreadyAssignee = await Card.exists({ $and: [{ _id: cardId }, { assignee: assignUser }] });
										if (!theUserAlreadyAssignee) {
											assignUserOk = true;
										} else {
											issue.assignUser = "Tried assign users is already assigned to the Card!";
										}
									} else {
										issue.assignUser = "Only owner can assign guest user!";
									}
								} else {
									issue.assignUser = "There is no user with this obj id!";
								}
							} else {
								if (isValidAssignUserId) {
									issue.assignUser = "Invalid assignUser id!";
								} else {
									issue.assignUser = "Invalid email!";
								}
							}
						} else {
							assignUser = undefined;
							assignUserOk = true;
						}

						// removeAssignedUser check
						if (removeAssignedUser) {
							if (isValidObjectId(removeAssignedUser)) {
								const theUserAlreadyAssignee = await Card.exists({ $and: [{ _id: cardId }, { assignee: removeAssignedUser }] });
								if (theUserAlreadyAssignee) {
									removeAssignedUserOk = true;
								} else {
									issue.removeAssignedUser = "The user is not assigned to the card!";
								}
							} else {
								issue.removeAssignedUser = "Invalid removeAssignedUser id!";
							}
						} else {
							removeAssignedUser = undefined;
							removeAssignedUserOk = true;
						}

						// removeTagId check
						if (removeTagId) {
							if (isValidObjectId(removeTagId)) {
								const tagExists = await Card.exists({ $and: [{ _id: cardId }, { tags: removeTagId }] });
								if (tagExists) {
									removeTagIdOk = true;
								} else {
									issue.removeTagId = "The tag is not assigned to the card!";
								}
							} else {
								issue.removeTagId = "Invalid removeTagId id!";
							}
						} else {
							removeTagId = undefined;
							removeTagIdOk = true;
						}

						if (nameOk && descriptionOk && progressOk && tagIdOk && startDateOk && endDateOk && assignUserOk && removeAssignedUserOk && removeTagIdOk) {
							let attachmentsUrl;
							let attachmentsOk;
							const files = req.files;
							if (files) {
								if (files.attachments) {
									const { filesUrl, errorMessage } = await multipleFilesCheckAndUpload(files.attachments);
									if (!errorMessage) {
										attachmentsUrl = filesUrl;
										attachmentsOk = true;
									} else {
										issue.attachments = errorMessage;
									}
								} else {
									attachmentsOk = true;
								}
							} else {
								attachmentsOk = true;
							}

							if (attachmentsOk) {
								const updatedCard = await Card.updateOne(
									{ _id: cardId },
									{
										name,
										description,
										progress,
										startDate,
										endDate,
										seenBy: [user._id], // Mark as unseen this card to all as updated card
										$push: {
											tags: tagId,
											assignee: assignUser,
											attachments: attachmentsUrl,
										},
										$pull: {
											tags: removeTagId,
											attachments: removeAttachmentUrl,
											assignee: removeAssignedUser,
										},
									},
								);

								const card = await Card.findOne({ _id: cardId })
									.select("-createdAt -updatedAt -creator")
									.populate([
										{
											path: "tags",
											select: "name color",
										},
										{
											path: "checkList",
											select: "content checked spaceRef cardRef assignee",
										},
										{
											path: "assignee",
											select: "fullName username avatar",
										},
									]);

								res.json({ updatedCard: card });

								if (assignUser) {
									// mail sending to the user who assigned to the task
									const dynamicTemplateData = {
										name: assignUserData.fullName,
										assignedBy: user.fullName,
										taskName: card.name,
									};
									mailSendWithDynamicTemplate(assignUserData.email, process.env.TEMPLATE_ID_ASSIGN_TASK, dynamicTemplateData);

									// notification creating for the user who assigned to the task
									const notificationStructure = new Notification({
										user: assignUserData._id,
										message: `${user.fullName} has assigned you to ${card.name} task`,
									});
									notificationStructure.save();
								}

								// notification creating for the assigned members about updating task
								for (member of card.assignee) {
									const notificationStructure = new Notification({
										user: member._id,
										message: `Task ${card.name} has been updated by ${user.fullName}`,
									});
									notificationStructure.save();
								}
							}
						}
					} else {
						issue.spaceId = "You have no access to this space!";
					}
				} else {
					issue.spaceId = "Not found space!";
				}
			} else {
				issue.cardId = "Not found card!";
			}
		} else {
			if (!isValidSpaceId) {
				issue.spaceId = "Invalid space id!";
			} else if (!isValidListId) {
				issue.listId = "Invalid list id!";
			} else if (!isValidCardId) {
				issue.cardId = "Invalid card id!";
			}
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};
exports.createCardWithAI = async (req, res, next) => {
	let { spaceId, listId } = req.params;
	let { name, description, progress, tagId, startDate, endDate, assignUser, checkList, estimatedTime } = req.body;

	try {
		let nameOk, descriptionOk, progressOk, tagIdOk, startDateOk, endDateOk, assignUserOk;
		const user = req.user;
		const issue = {};

		const isValidSpaceId = isValidObjectId(spaceId);
		const isValidListId = isValidObjectId(listId);
		const existList = await List.findOne({ _id: listId });
		if (isValidSpaceId && isValidListId) {
			const existsSpace = await Space.findOne({ _id: spaceId }).select("workSpaceRef");
			if (existsSpace) {
				// check card name
				if (name) {
					name = String(name)
						.replace(/\r\n/g, " ")
						.replace(/[\r\n]/g, " ")
						.replace(/  +/g, " ")
						.trim();

					nameOk = true;
				} else {
					name = undefined;
					nameOk = true;
				}

				// check description
				if (description) {
					description = String(description).replace(/  +/g, " ").trim();
					descriptionOk = true;
				} else {
					description = undefined;
					descriptionOk = true;
				}
				if (estimatedTime) {
					estimatedTime = String(estimatedTime)
						.replace(/\r\n/g, " ")
						.replace(/[\r\n]/g, " ")
						.replace(/  +/g, " ")
						.trim();
				}

				// check progress number
				if (progress != undefined) {
					if (String(parseInt(progress, 10)) != "NaN") {
						progress = parseInt(progress, 10);
						if (progress >= 0 && progress <= 100) {
							progressOk = true;
						} else {
							issue.message = "Progress number can not be less than 0 and greater than 100!";
						}
					} else {
						issue.message = "Invalid progress number!";
					}
				} else {
					progress = undefined;
					progressOk = true;
				}

				// check tagId
				if (tagId) {
					if (isValidObjectId(tagId)) {
						const tagExists = await Tag.exists({ $and: [{ _id: tagId }, { workSpaceRef: existsSpace.workSpaceRef }] });
						if (tagExists) {
							tagIdOk = true;
						} else {
							issue.tagId = "Tag not found!!";
						}
					} else {
						issue.tagId = "Invalid tag id!";
					}
				} else {
					tagId = undefined;
					tagIdOk = true;
				}

				// check startDate
				if (startDate) {
					const startDateParts = startDate.split("/");

					startDate = new Date(`${startDateParts[2]}-${startDateParts[1]}-${startDateParts[0]}`).getTime();

					const validTimestamp = new Date(startDate) > 0;
					if (validTimestamp) {
						startDate = new Date(startDate);
						startDateOk = true;
					} else {
						issue.startDate = "Please provide the valid timestamp of start date!";
					}
				} else {
					startDate = undefined;
					startDateOk = true;
				}

				// check endDate
				if (endDate) {
					const endDateParts = endDate.split("/");
					endDate = new Date(`${endDateParts[2]}-${endDateParts[1]}-${endDateParts[0]}`).getTime();

					const validTimestamp = new Date(endDate) > 0;
					if (validTimestamp) {
						endDate = new Date(endDate);
						if (startDate && startDateOk) {
							if (endDate > startDate) {
								endDateOk = true;
							} else {
								issue.endDate = "End time should be greater than start time!";
							}
						}
					} else {
						issue.endDate = "Please provide the valid timestamp of end date!";
					}
				} else {
					endDate = undefined;
					endDateOk = true;
				}

				// assign user check
				if (assignUser) {
					const imIOwnerOfTheWorkspace = await Workspace.findOne({
						$and: [
							{ _id: existsSpace.workSpaceRef },
							{
								teamMembers: {
									$elemMatch: {
										member: req.user._id,
										role: "owner",
									},
								},
							},
						],
					}).select("_id");
					let assignedUsers = [];
					let assignUserDatas = [];
					let assignUserData;
					let user;
					for (const assigned of assignUser) {
						const isValidAssignUserId = isValidObjectId(assigned);
						if (isValidAssignUserId || isValidEmail(assigned)) {
							if (isValidAssignUserId) {
								assignUserData = await User.findOne({ _id: assigned }).select("_id fullName email guest");
								assignedUsers.push(assignUserData._id);
							} else if (isValidEmail(assigned)) {
								user = String(assigned).toLowerCase();
								assignedUsers.push({ assignUser });
								assignUserData = await User.findOne({ email: assigned }).select("_id fullName email guest");
								assignUserDatas.push({ assignUserData });
								if (!assignUserData) {
									const guestUser = new User({
										fullName: "Guest",
										email: assigned,
										username: await usernameGenerating(assigned),
										guest: true,
									});
									assignUserData = await guestUser.save();
									assignUserDatas.push({ assignUserData });
								}
							}
						} else {
							if (isValidAssignUserId) {
								issue.assignUser = "Invalid assignUser id!";
							} else {
								issue.assignUser = "Invalid email!";
							}
						}
						let newUser;
						if (assignedUsers.length > 0) {
							for (const user of assignedUsers) {
								newUser = user;
								if (!assignUserData.guest || imIOwnerOfTheWorkspace) {
									const assignUserExistsInSpace = await Space.exists({ $and: [{ _id: spaceId }, { "members.member": user }] });
									if (!assignUserExistsInSpace) {
										const assignUserExistsInWorkspace = await Workspace.exists({ $and: [{ _id: existsSpace.workSpaceRef }, { "teamMembers.member": user }] });
										if (!assignUserExistsInWorkspace) {
											// User push in Workspace
											await Workspace.updateOne(
												{ _id: existsSpace.workSpaceRef },
												{
													$push: {
														teamMembers: {
															member: user,
														},
													},
												},
											);
										}

										// Members push in space
										await Space.updateOne(
											{ _id: spaceId },
											{
												$push: {
													members: {
														member: user,
													},
												},
											},
										);
									}

									assignUserOk = true;
								} else {
									issue.assignUser = "Only owner can assign guest user!";
								}
							}
						} else {
							issue.assignUser = "There is no user with this obj id!";
						}
					}
				} else {
					assignUser = undefined;
					assignUserOk = true;
				}
				// generate order number
				let orderNumber;
				const existsCard = await Card.exists({ $and: [{ listRef: listId }, { order: 1 }] });
				if (existsCard) {
					const highest = await Card.findOne({ listRef: listId }).sort({ order: -1 }).select("order");
					orderNumber = highest.order + 1;
				} else {
					orderNumber = 1;
				}

				if (nameOk && descriptionOk && progressOk && tagIdOk && startDateOk && endDateOk && assignUserOk) {
					const newCard = new Card({
						name,
						description,
						startDate,
						endDate,
						seenBy: [user._id],
						tags: tagId,
						listRef: listId,
						spaceRef: spaceId,
						assignee: assignUser,
						creator: user._id,
						cardKey: await cardKeyGen(existList.spaceRef),
						color: hexAColorGen(),
						order: orderNumber,
						estimatedTime: estimatedTime,
					});
					const saveCard = await newCard.save();

					const checkLists = [];
					if (checkList) {
						for (const check of checkList) {
							const newCheckList = new Checklist({
								content: check,
								checked: false,
								spaceRef: spaceId,
								cardRef: saveCard._id,
							});
							const saveCardList = await newCheckList.save();
							checkLists.push(newCheckList._id);
						}
						const updateCard = await Card.updateOne({ _id: saveCard._id }, { $set: { checkList: checkLists } });
					}

					const card = await Card.findOne({ _id: saveCard._id })
						.select("-createdAt -updatedAt -creator")
						.populate([
							{
								path: "tags",
								select: "name color",
							},
							{
								path: "checkList",
								select: "content checked spaceRef cardRef assignee",
							},
							{
								path: "assignee",
								select: "fullName username avatar email",
							},
						]);
					if (card) {
						return res.status(201).json({
							success: true,
							data: card,
						});
					}
					for (member of card.assignee) {
						const dynamicTemplateData = {
							name: member.fullName,
							assignedBy: user.fullName,
							taskName: card.name,
						};
						const sendMail = await mailSendWithDynamicTemplate(member.email, process.env.TEMPLATE_ID_ASSIGN_TASK, dynamicTemplateData);

						// notification creating for the user who assigned to the task
						const notificationStructure = new Notification({
							user: member._id,
							message: `${user.fullName} has assigned you to ${card.name} task`,
						});
						notificationStructure.save();
					}

					// notification creating for the assigned members about updating task
					for (member of card.assignee) {
						const notificationStructure = new Notification({
							user: member._id,
							message: `Task ${card.name} has been updated by ${user.fullName}`,
						});
						notificationStructure.save();
					}
				}
			} else {
				issue.spaceId = "Not found space!";
			}
		} else {
			if (!isValidSpaceId) {
				issue.spaceId = "Invalid space id!";
			} else if (!isValidListId) {
				issue.listId = "Invalid list id!";
			} else if (!isValidCardId) {
				issue.cardId = "Invalid card id!";
			}
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};
exports.moveCard = async (req, res, next) => {
	let { spaceId, listId, cardId } = req.params;
	let { newListId, order } = req.body;

	try {
		const user = req.user;
		const issue = {};

		const isValidSpaceId = isValidObjectId(spaceId);
		const isValidListId = isValidObjectId(listId);
		const isValidCardId = isValidObjectId(cardId);
		if (isValidSpaceId && isValidListId && isValidCardId) {
			const cardExists = await Card.findOne({ _id: cardId }).select("startDate spaceRef listRef order");
			if (cardExists) {
				const existsSpace = await Space.findOne({ _id: cardExists.spaceRef }).select("workSpaceRef");
				if (existsSpace) {
					const doIHaveAccess = await Space.exists({ $and: [{ _id: cardExists.spaceRef }, { "members.member": user._id }] });
					if (doIHaveAccess) {
						if (newListId) {
							const isValidNewListId = isValidObjectId(newListId);
							if (isValidNewListId) {
								const existsMoveToList = await List.exists({ _id: newListId });
								if (existsMoveToList) {
									const isValidToMoveToNewList = await List.exists({ $and: [{ _id: newListId }, { spaceRef: cardExists.spaceRef }] });
									if (isValidToMoveToNewList) {
										// order num check
										let orderOk;
										if (!(order === undefined || order === "")) {
											order = parseInt(order);
											if (order) {
												if (order > 0) {
													orderOk = true;
												} else {
													issue.order = "Order number number should be greater than 0!";
												}
											} else {
												issue.order = "Invalid order number!";
											}
										} else {
											order = undefined;
											orderOk = true;
										}

										if (orderOk) {
											let orderNumber = order;
											if (!order) {
												// generate order number
												const existsCard = await Card.exists({ $and: [{ listRef: newListId }, { order: 1 }] });
												if (existsCard) {
													const highest = await Card.findOne({ listRef: newListId }).sort({ order: -1 }).select("order");
													orderNumber = highest.order + 1;
												} else {
													orderNumber = 1;
												}
											}

											await Card.updateOne(
												{ _id: cardId },
												{
													listRef: newListId,
													order: orderNumber,
												},
											);

											const card = await Card.findOne({ _id: cardId }).select("name listRef order spaceRef");
											res.json({ card });

											/****  START: cards order number rearrange ****/
											// Rearrange the card order number of the previous list
											let odrNum = cardExists.order;
											const cards = await Card.find({ $and: [{ order: { $gte: odrNum } }, { listRef: cardExists.listRef }] })
												.sort({ order: 1 })
												.select("_id");
											for (const card of cards) {
												await Card.updateOne(
													{ _id: card._id },
													{
														order: odrNum,
													},
												);
												odrNum = odrNum + 1;
											}
											/****  END: cards order number rearrange ****/

											if (order) {
												/****  START: cards order number rearrange ****/
												// Rearrange the card order number of the new list
												const cards = await Card.find({ $and: [{ order: { $gte: order } }, { _id: { $ne: cardId } }, { listRef: newListId }] })
													.sort({ order: 1 })
													.select("_id");
												for (const card of cards) {
													order = order + 1;
													await Card.updateOne(
														{ _id: card._id },
														{
															order: order,
														},
													);
												}
												/****  END: cards order number rearrange ****/
											}
										}
									} else {
										issue.message = "Unable to perform the operation!";
									}
								} else {
									issue.message = "Not found new List!";
								}
							} else {
								issue.message = "Invalid new List id!";
							}
						} else {
							issue.message = "Please provide new List id!";
						}
					} else {
						issue.message = "You have no access to this space!";
					}
				} else {
					issue.message = "Not found space!";
				}
			} else {
				issue.message = "Not found card!";
			}
		} else {
			if (!isValidSpaceId) {
				issue.message = "Invalid space id!";
			} else if (!isValidListId) {
				issue.message = "Invalid list id!";
			} else if (!isValidCardId) {
				issue.message = "Invalid card id!";
			}
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

exports.copyCard = async (req, res, next) => {
	let { spaceId, listId, cardId } = req.params;
	let { name } = req.body;

	try {
		const user = req.user;
		const issue = {};

		name = name
			? String(name)
					.replace(/\r\n/g, " ")
					.replace(/[\r\n]/g, " ")
					.replace(/  +/g, " ")
					.trim()
			: undefined;

		const isValidSpaceId = isValidObjectId(spaceId);
		const isValidListId = isValidObjectId(listId);
		const isValidCardId = isValidObjectId(cardId);
		if (isValidSpaceId && isValidListId && isValidCardId) {
			let cardExists = await Card.findOne({ _id: cardId }).select("name description progress tags attachments startDate endDate assignee spaceRef listRef");
			if (cardExists) {
				const existsSpace = await Space.exists({ _id: cardExists.spaceRef });
				if (existsSpace) {
					const doIHaveAccess = await Space.exists({ $and: [{ _id: cardExists.spaceRef }, { "members.member": user._id }] });
					if (doIHaveAccess) {
						// generate order number
						let orderNumber;
						const existsCard = await Card.exists({ $and: [{ listRef: cardExists.listRef }, { order: 1 }] });
						if (existsCard) {
							const highest = await Card.findOne({ listRef: cardExists.listRef }).sort({ order: -1 }).select("order");
							orderNumber = highest.order + 1;
						} else {
							orderNumber = 1;
						}

						cardExists = JSON.parse(JSON.stringify(cardExists));
						cardExists._id = undefined;
						cardExists.name = name ? name : `Copy of ${cardExists.name}`;

						const newCardOfCopy = new Card({
							...cardExists,
							creator: user._id,
							order: orderNumber,
						});
						const copiedCard = await newCardOfCopy.save();

						return res.json({ copiedCard });
					} else {
						issue.spaceId = "You have no access to this space!";
					}
				} else {
					issue.spaceId = "Not found space!";
				}
			} else {
				issue.cardId = "Not found card!";
			}
		} else {
			if (!isValidSpaceId) {
				issue.spaceId = "Invalid space id!";
			} else if (!isValidListId) {
				issue.listId = "Invalid list id!";
			} else if (!isValidCardId) {
				issue.cardId = "Invalid card id!";
			}
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

exports.deleteCard = async (req, res, next) => {
	let { spaceId, listId, cardId } = req.params;

	try {
		const user = req.user;
		const issue = {};

		const isValidSpaceId = isValidObjectId(spaceId);
		const isValidListId = isValidObjectId(listId);
		const isValidCardId = isValidObjectId(cardId);
		if (isValidSpaceId && isValidListId && isValidCardId) {
			const cardExists = await Card.findOne({ _id: cardId }).select("startDate spaceRef listRef order");
			if (cardExists) {
				const existsSpace = await Space.findOne({ _id: cardExists.spaceRef }).select("workSpaceRef");
				if (existsSpace) {
					const doIHaveAccess = await Space.exists({ $and: [{ _id: cardExists.spaceRef }, { "members.member": user._id }] });
					if (doIHaveAccess) {
						const deleteCard = await Card.deleteOne({ _id: cardId });
						if (deleteCard.deletedCount) {
							res.json({ message: "Successfully deleted card!" });

							/****  START: cards order number rearrange ****/
							const cards = await Card.find({ $and: [{ order: { $gte: cardExists.order } }, { listRef: cardExists.listRef }] })
								.sort({ order: 1 })
								.select("_id");
							let order = cardExists.order;
							for (const card of cards) {
								await Card.updateOne(
									{ _id: card._id },
									{
										order,
									},
								);
								order = order + 1;
							}
							/****  END: cards order number rearrange ****/

							await Checklist.deleteMany({ cardRef: cardId });
							await CommentChat.deleteMany({ to: cardId });
						} else {
							issue.message = "Failed to delete card!";
						}
					} else {
						issue.message = "You have no access to this space!";
					}
				} else {
					issue.message = "Not found space!";
				}
			} else {
				issue.message = "Not found card!";
			}
		} else {
			if (!isValidSpaceId) {
				issue.message = "Invalid space id!";
			} else if (!isValidListId) {
				issue.message = "Invalid list id!";
			} else if (!isValidCardId) {
				issue.message = "Invalid card id!";
			}
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

exports.orderOrSortCard = async (req, res, next) => {
	let { spaceId, listId, cardId } = req.params;
	let { order } = req.body;

	try {
		let orderOk;
		const user = req.user;
		const issue = {};

		const isValidSpaceId = isValidObjectId(spaceId);
		const isValidListId = isValidObjectId(listId);
		const isValidCardId = isValidObjectId(cardId);
		if (isValidSpaceId && isValidListId && isValidCardId) {
			const cardExists = await Card.findOne({ _id: cardId }).select("spaceRef listRef order");
			if (cardExists) {
				const existsSpace = await Space.findOne({ _id: cardExists.spaceRef }).select("workSpaceRef");
				if (existsSpace) {
					const doIHaveAccess = await Space.exists({ $and: [{ _id: cardExists.spaceRef }, { "members.member": user._id }] });
					if (doIHaveAccess) {
						// order check
						if (order) {
							order = parseInt(order);
							if (order) {
								if (order > 0) {
									orderOk = true;
								} else {
									issue.order = "Order number number should be greater than 0!";
								}
							} else {
								issue.order = "Invalid order number!";
							}
						} else {
							issue.order = "Please provide order/sorting number!";
						}

						if (orderOk) {
							if (cardExists.order < order) {
								/****  START: previous cards order number rearrange ****/
								const cards = await Card.find({ $and: [{ order: { $lte: order } }, { _id: { $ne: cardId } }, { listRef: cardExists.listRef }] })
									.sort({ order: 1 })
									.select("_id");

								let orderNum = 1;
								for (const card of cards) {
									await Card.updateOne(
										{ _id: card._id },
										{
											order: orderNum,
										},
									);
									orderNum = orderNum + 1;
								}
								/****  END: previous cards order number rearrange ****/
							}

							// Update cards order
							await Card.updateOne(
								{ _id: cardId },
								{
									order,
								},
							);

							const card = await Card.findOne({ _id: cardId })
								.select("-createdAt -updatedAt -creator")
								.populate([
									{
										path: "tags",
										select: "name color",
									},
									{
										path: "checkList",
										select: "content checked spaceRef cardRef assignee",
									},
									{
										path: "assignee",
										select: "fullName username avatar",
									},
								]);

							res.json({ updatedCard: card });

							if (cardExists.order > order) {
								/****  START: next cards order number rearrange ****/
								const cards = await Card.find({ $and: [{ order: { $gte: order } }, { _id: { $ne: cardId } }, { listRef: cardExists.listRef }] })
									.sort({ order: 1 })
									.select("_id");
								let orderNum = order;
								for (const card of cards) {
									orderNum = orderNum + 1;
									await Card.updateOne(
										{ _id: card._id },
										{
											order: orderNum,
										},
									);
								}
								/****  END: next cards order number rearrange ****/
							}

							/****  START: All cards order number rearrange ****/
							const allCards = await Card.find({ listRef: cardExists.listRef }).sort({ order: 1 }).select("_id");
							let orderNum = 1;
							for (const card of allCards) {
								await Card.updateOne(
									{ _id: card._id },
									{
										order: orderNum,
									},
								);
								orderNum = orderNum + 1;
							}
							/****  END: All cards order number rearrange ****/
						}
					} else {
						issue.spaceId = "You have no access to this space!";
					}
				} else {
					issue.spaceId = "Not found space!";
				}
			} else {
				issue.cardId = "Not found card!";
			}
		} else {
			if (!isValidSpaceId) {
				issue.spaceId = "Invalid space id!";
			} else if (!isValidListId) {
				issue.listId = "Invalid list id!";
			} else if (!isValidCardId) {
				issue.cardId = "Invalid card id!";
			}
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

exports.createChecklistItem = async (req, res, next) => {
	let { spaceId, listId, cardId } = req.params;
	let { content } = req.body;

	try {
		let contentOk;
		const user = req.user;
		const issue = {};

		const isValidSpaceId = isValidObjectId(spaceId);
		const isValidListId = isValidObjectId(listId);
		const isValidCardId = isValidObjectId(cardId);
		if (isValidSpaceId && isValidListId && isValidCardId) {
			const cardExists = await Card.findOne({ _id: cardId }).select("startDate spaceRef");
			if (cardExists) {
				const existsSpace = await Space.exists({ _id: cardExists.spaceRef });
				if (existsSpace) {
					const doIHaveAccess = await Space.exists({ $and: [{ _id: cardExists.spaceRef }, { "members.member": user._id }] });
					if (doIHaveAccess) {
						// check card content
						if (content) {
							content = String(content)
								.replace(/\r\n/g, " ")
								.replace(/[\r\n]/g, " ")
								.replace(/  +/g, " ")
								.trim();

							contentOk = true;
						} else {
							issue.message = "Please provide checklist content";
						}

						if (contentOk) {
							const checklistStructure = new Checklist({
								content,
								spaceRef: cardExists.spaceRef,
								cardRef: cardExists._id,
							});
							const saveCheckListItem = await checklistStructure.save();

							await Card.updateOne(
								{ _id: cardExists._id },
								{
									$push: {
										checkList: saveCheckListItem._id,
									},
								},
							);

							return res.json({ checkListItem: saveCheckListItem });
						}
					} else {
						issue.spaceId = "You have no access to this space!";
					}
				} else {
					issue.spaceId = "Not found space!";
				}
			} else {
				issue.cardId = "Not found card!";
			}
		} else {
			if (!isValidSpaceId) {
				issue.spaceId = "Invalid space id!";
			} else if (!isValidListId) {
				issue.listId = "Invalid list id!";
			} else if (!isValidCardId) {
				issue.cardId = "Invalid card id!";
			}
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

exports.updateChecklistItem = async (req, res, next) => {
	let { spaceId, listId, cardId, checklistId } = req.params;
	let { content, checked: check, assignUser, removeAssignedUser } = req.body;

	try {
		let contentOk, assignUserOk, removeAssignedUserOk;
		const user = req.user;
		const issue = {};

		const isValidSpaceId = isValidObjectId(spaceId);
		const isValidListId = isValidObjectId(listId);
		const isValidCardId = isValidObjectId(cardId);
		const isValidChecklistId = isValidObjectId(checklistId);
		if (isValidSpaceId && isValidListId && isValidCardId && isValidChecklistId) {
			const checklistItemExists = await Checklist.findOne({ _id: checklistId }).select("spaceRef cardRef");
			if (checklistItemExists) {
				const existsSpace = await Space.exists({ _id: checklistItemExists.spaceRef });
				if (existsSpace) {
					const doIHaveAccess = await Space.exists({ $and: [{ _id: checklistItemExists.spaceRef }, { "members.member": user._id }] });
					if (doIHaveAccess) {
						if (content) {
							content = String(content)
								.replace(/\r\n/g, " ")
								.replace(/[\r\n]/g, " ")
								.replace(/  +/g, " ")
								.trim();

							contentOk = true;
						} else {
							content = undefined;
							contentOk = true;
						}

						if (check !== undefined && check !== "") {
							if (check == false || String(check).toLocaleLowerCase() == "false" || check == 0) {
								check = false;
							} else {
								check = true;
							}
						} else {
							check = undefined;
						}

						// assign user check
						if (assignUser) {
							if (isValidObjectId(assignUser)) {
								const userExists = await User.exists({ _id: assignUser });
								if (userExists) {
									const assignUserExistsInSpace = await Space.exists({ $and: [{ _id: checklistItemExists.spaceRef }, { "members.member": assignUser }] });
									if (assignUserExistsInSpace) {
										const theUserAlreadyAssignee = await Checklist.exists({ $and: [{ _id: checklistItemExists._id }, { assignee: assignUser }] });
										if (!theUserAlreadyAssignee) {
											assignUserOk = true;
										} else {
											issue.assignUser = "Tried assign users is already assigned to the Checklist item!";
										}
									} else {
										issue.assignUser = "Assign users must first add to space!!";
									}
								} else {
									issue.assignUser = "Assign user does't exists!";
								}
							} else {
								issue.assignUser = "Invalid assignUser id!";
							}
						} else {
							assignUser = undefined;
							assignUserOk = true;
						}

						// removeAssignedUser check
						if (removeAssignedUser) {
							if (isValidObjectId(removeAssignedUser)) {
								const theUserAlreadyAssignee = await Checklist.exists({ $and: [{ _id: checklistItemExists._id }, { assignee: removeAssignedUser }] });
								if (theUserAlreadyAssignee) {
									removeAssignedUserOk = true;
								} else {
									issue.removeAssignedUser = "The user is not assigned to the check list item!";
								}
							} else {
								issue.removeAssignedUser = "Invalid removeAssignedUser id!";
							}
						} else {
							removeAssignedUser = undefined;
							removeAssignedUserOk = true;
						}

						if (contentOk && assignUserOk && removeAssignedUserOk) {
							await Checklist.updateOne(
								{ _id: checklistItemExists._id },
								{
									content,
									checked: check,
									$push: {
										assignee: assignUser,
									},
									$pull: {
										assignee: removeAssignedUser,
									},
								},
							);

							const getUpdated = await Checklist.findOne({ _id: checklistItemExists._id }).populate({
								path: "assignee",
								select: "fullName username avatar",
							});

							return res.json({ checkListItem: getUpdated });
						}
					} else {
						issue.spaceId = "You have no access to this space!";
					}
				} else {
					issue.spaceId = "Not found space!";
				}
			} else {
				issue.cardId = "Not found checklist!";
			}
		} else {
			if (!isValidSpaceId) {
				issue.spaceId = "Invalid space id!";
			} else if (!isValidListId) {
				issue.listId = "Invalid list id!";
			} else if (!isValidCardId) {
				issue.cardId = "Invalid card id!";
			} else if (!isValidChecklistId) {
				issue.cardId = "Invalid checklist item id!";
			}
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

exports.deleteChecklistItem = async (req, res, next) => {
	let { spaceId, listId, cardId, checklistId } = req.params;

	try {
		const user = req.user;
		const issue = {};

		const isValidSpaceId = isValidObjectId(spaceId);
		const isValidListId = isValidObjectId(listId);
		const isValidCardId = isValidObjectId(cardId);
		const isValidChecklistId = isValidObjectId(checklistId);
		if (isValidSpaceId && isValidListId && isValidCardId && isValidChecklistId) {
			const checklistItemExists = await Checklist.findOne({ _id: checklistId }).select("spaceRef cardRef");
			if (checklistItemExists) {
				const existsSpace = await Space.exists({ _id: checklistItemExists.spaceRef });
				if (existsSpace) {
					const doIHaveAccess = await Space.exists({ $and: [{ _id: checklistItemExists.spaceRef }, { "members.member": user._id }] });
					if (doIHaveAccess) {
						await Checklist.deleteOne({ _id: checklistItemExists._id });
						await Card.updateOne(
							{ _id: checklistItemExists.cardRef },
							{
								$pull: {
									checkList: checklistItemExists._id,
								},
							},
						);

						return res.json({ message: "Successfully removed the checklist item" });
					} else {
						issue.spaceId = "You have no access to this space!";
					}
				} else {
					issue.spaceId = "Not found space!";
				}
			} else {
				issue.cardId = "Not found Checklist item!";
			}
		} else {
			if (!isValidSpaceId) {
				issue.spaceId = "Invalid space id!";
			} else if (!isValidListId) {
				issue.listId = "Invalid list id!";
			} else if (!isValidCardId) {
				issue.cardId = "Invalid card id!";
			} else if (!isValidChecklistId) {
				issue.cardId = "Invalid checklist item id!";
			}
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

exports.createComment = async (req, res, next) => {
	let { textMessage, replayOf } = req.body;
	let mentionedUsers = [],
		attachmentsUrls = [];
	let { spaceId, listId, cardId } = req.params;
	try {
		const user = req.user;
		const issue = {};

		let textMessageOk, attachmentsOk, spaceIdOk, listIdOk, cardIdOk, replayOfOk;

		// text message check
		if (textMessage) {
			textMessage = String(textMessage).replace(/  +/g, " ").trim();
			const splitIds = splitSpecificParts(textMessage, "{{", "}}");
			const ids = [];
			for (const id of splitIds) {
				if (isValidObjectId(id)) {
					ids.push(id);
				}
			}
			if (ids.length > 0) {
				const validMentionedUsers = await User.find({ _id: { $in: ids } }).select("_id");
				for (const user of validMentionedUsers) {
					mentionedUsers.push(user._id);
				}
			}
			textMessageOk = true;
		} else {
			textMessageOk = true;
		}

		// check spaceId, listId, cardId
		const isValidSpaceId = isValidObjectId(spaceId);
		const isValidListId = isValidObjectId(listId);
		const isValidCardId = isValidObjectId(cardId);
		if (isValidSpaceId && isValidListId && isValidCardId) {
			listIdOk = true;
			const getCard = await Card.findOne({ _id: cardId }).select("spaceRef");
			if (getCard) {
				cardIdOk = true;
				spaceId = getCard.spaceRef;
				const spaceExists = await Space.exists({ _id: spaceId });
				if (spaceExists) {
					const doIHaveAccessToSendMessage = await Space.exists({ $and: [{ _id: spaceId }, { "members.member": user._id }] });
					if (doIHaveAccessToSendMessage) {
						spaceIdOk = true;
					} else {
						issue.spaceId = "You are not a member of the space!!";
					}
				} else {
					issue.spaceId = "Not found space";
				}
			} else {
				issue.cardId = "Not found card";
			}
		} else {
			if (!isValidSpaceId) {
				issue.spaceId = "Invalid space id";
			}
			if (!isValidListId) {
				issue.listId = "Invalid list id";
			}
			if (!isValidCardId) {
				issue.cardId = "Invalid card id";
			}
		}

		// replayOf id check
		if (replayOf) {
			if (isValidSpaceId) {
				if (isValidObjectId(replayOf)) {
					const commentChatExists = await CommentChat.exists({ $and: [{ _id: replayOf }, { to: cardId }] });
					replayOfOk = true;
					replayOf = commentChatExists ? replayOf : undefined;
				} else {
					issue.replayOf = "Invalid replayOf id";
				}
			}
		} else {
			replayOfOk = true;
		}

		if (textMessageOk && spaceIdOk && listIdOk && cardIdOk && replayOfOk) {
			const files = req.files;
			if (files) {
				if (files.attachments) {
					const { filesUrl, errorMessage } = await multipleFilesCheckAndUpload(files.attachments);
					if (!errorMessage) {
						attachmentsUrls = filesUrl;
						attachmentsOk = true;
					} else {
						issue.attachments = errorMessage;
					}
				} else {
					attachmentsOk = true;
				}
			} else {
				attachmentsOk = true;
			}

			if (attachmentsOk) {
				const SpaceChatStructure = new CommentChat({
					sender: user._id,
					to: cardId,
					spaceRef: spaceId,
					replayOf,
					content: {
						text: textMessage,
						attachments: attachmentsUrls,
						mentionedUsers,
					},
				});

				const saveMessage = await SpaceChatStructure.save();

				const getTheComment = await CommentChat.findOne({ _id: saveMessage._id }).populate([
					{
						path: "sender",
						select: "fullName username avatar",
					},
					{
						path: "replayOf",
						select: "content editedAt createdAt",
						populate: [
							{
								path: "sender",
								select: "fullName username avatar",
							},
							{
								path: "content.mentionedUsers",
								select: "fullName username avatar",
							},
						],
					},
					{
						path: "content.mentionedUsers",
						select: "fullName username avatar",
					},
					{
						path: "seenBy",
						select: "fullName username avatar",
					},
					{
						path: "reactions.reactor",
						select: "fullName username avatar",
					},
				]);

				res.status(201).json({ comment: getTheComment });

				// Operation for unseen message update as seen
				CommentChat.updateMany(
					{
						$and: [
							{ to: cardId },
							{
								$nor: [{ sender: user._id }, { seenBy: user._id }],
							},
						],
					},
					{ $push: { seenBy: user._id } },
				).then();
				// Operation End

				// Mark as unseen this card who are mentioned in this comment
				if (mentionedUsers.length) {
					await Card.updateOne(
						{ _id: cardId },
						{
							$pull: {
								seenBy: { $in: mentionedUsers },
							},
						},
					);

					const cardData = await Card.findOne({ _id: cardId }).select("name");

					// notification creating for the all mentioned users
					const mentionedUsersData = await User.find({ _id: { $in: mentionedUsers } }).select("_id");
					for (const each of mentionedUsersData) {
						const notificationStructure = new Notification({
							user: each._id,
							message: `${user.fullName} has mentioned you to ${cardData.name} task comments`,
						});
						notificationStructure.save();
					}

					// mail send to mentioned users who is not online
					const dt = new Date();
					dt.setMinutes(dt.getMinutes() - 1);
					const mentionedOnlineUsersData = await User.find({ $and: [{ _id: { $in: mentionedUsers } }, { $or: [{ socketId: { $ne: null } }, { lastOnline: { $lt: dt } }] }] }).select("_id fullName email");

					for (const each of mentionedOnlineUsersData) {
						const dynamicTemplateData = {
							name: each.fullName,
							mentionedBy: user.fullName,
							task: cardData.name,
						};
						mailSendWithDynamicTemplate(each.email, process.env.TEMPLATE_ID_MENTION_IN_TASK_COMMENT, dynamicTemplateData);
					}
				}
			}
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

exports.getComments = async (req, res, next) => {
	let { spaceId, listId, cardId } = req.params;
	let { skip, limit } = req.query;
	try {
		limit = parseInt(limit) || 20;
		skip = parseInt(skip) || 0;
		const user = req.user;
		const issue = {};

		// check spaceId, listId, cardId
		const isValidSpaceId = isValidObjectId(spaceId);
		const isValidListId = isValidObjectId(listId);
		const isValidCardId = isValidObjectId(cardId);
		if (isValidSpaceId && isValidListId && isValidCardId) {
			const getCard = await Card.findOne({ _id: cardId }).select("spaceRef");
			if (getCard) {
				spaceId = getCard.spaceRef;
				const spaceExists = await Space.exists({ _id: spaceId });
				if (spaceExists) {
					const doIHaveAccess = await Space.exists({ $and: [{ _id: spaceId }, { "members.member": user._id }] });
					if (doIHaveAccess) {
						const getTheComments = await CommentChat.find({ $and: [{ to: cardId }, { deleted: false }] })
							.sort({ createdAt: -1 })
							.populate([
								{
									path: "sender",
									select: "fullName username avatar",
								},
								{
									path: "replayOf",
									select: "content editedAt createdAt",
									populate: [
										{
											path: "sender",
											select: "fullName username avatar",
										},
										{
											path: "content.mentionedUsers",
											select: "fullName username avatar",
										},
									],
								},
								{
									path: "content.mentionedUsers",
									select: "fullName username avatar",
								},
								{
									path: "seenBy",
									select: "fullName username avatar",
								},
								{
									path: "reactions.reactor",
									select: "fullName username avatar",
								},
							])
							.skip(skip)
							.limit(limit);

						res.json({ comments: getTheComments });

						// Operation for unseen message update as seen
						CommentChat.updateMany(
							{
								$and: [
									{ to: cardId },
									{
										$nor: [{ sender: user._id }, { seenBy: user._id }],
									},
								],
							},
							{ $push: { seenBy: user._id } },
						).then();
						// Operation End
					} else {
						issue.spaceId = "You are not a member of the space!!";
					}
				} else {
					issue.spaceId = "Not found space";
				}
			} else {
				issue.cardId = "Not found card";
			}
		} else {
			if (!isValidSpaceId) {
				issue.spaceId = "Invalid space id";
			}
			if (!isValidListId) {
				issue.listId = "Invalid list id";
			}
			if (!isValidCardId) {
				issue.cardId = "Invalid card id";
			}
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

exports.commentsEdit = async (req, res, next) => {
	let { spaceId, listId, cardId, commentId } = req.params;
	let { updateComment } = req.body;

	try {
		const user = req.user;
		const issue = {};

		// check spaceId, listId, cardId, commentId
		const isValidSpaceId = isValidObjectId(spaceId);
		const isValidListId = isValidObjectId(listId);
		const isValidCardId = isValidObjectId(cardId);
		const isValidCommentId = isValidObjectId(commentId);
		if (isValidSpaceId && isValidListId && isValidCardId && isValidCommentId) {
			const getComment = await CommentChat.findOne({ _id: commentId }).select("spaceRef");
			if (getComment) {
				spaceId = getComment.spaceRef;
				const spaceExists = await Space.exists({ _id: spaceId });
				if (spaceExists) {
					const doIHaveAccess = await Space.exists({ $and: [{ _id: spaceId }, { "members.member": user._id }] });
					const doAccessToEdit1 = await CommentChat.exists({ $and: [{ _id: commentId }, { sender: user._id }] });
					if (doIHaveAccess && doAccessToEdit1) {
						// text comment check
						if (updateComment) {
							updateComment = String(updateComment).replace(/  +/g, " ").trim();
							const splitIds = splitSpecificParts(updateComment, "{{", "}}");
							const ids = [];
							for (const id of splitIds) {
								if (isValidObjectId(id)) {
									ids.push(id);
								}
							}
							let mentionedUsers = [];
							if (ids.length > 0) {
								const validMentionedUsers = await User.find({ _id: { $in: ids } }).select("_id");
								for (const user of validMentionedUsers) {
									mentionedUsers.push(user._id);
								}
							}

							const commentUpdate = await CommentChat.updateOne(
								{ _id: commentId },
								{
									"content.text": updateComment,
									"content.mentionedUsers": mentionedUsers,
									editedAt: Date.now(),
								},
							);

							if (commentUpdate.modifiedCount) {
								const getEditedComment = await CommentChat.findOne({ _id: commentId }).populate([
									{
										path: "sender",
										select: "fullName username avatar",
									},
									{
										path: "replayOf",
										select: "content editedAt createdAt",
										populate: [
											{
												path: "sender",
												select: "fullName username avatar",
											},
											{
												path: "content.mentionedUsers",
												select: "fullName username avatar",
											},
										],
									},
									{
										path: "content.mentionedUsers",
										select: "fullName username avatar",
									},
									{
										path: "seenBy",
										select: "fullName username avatar",
									},
									{
										path: "reactions.reactor",
										select: "fullName username avatar",
									},
								]);
								res.json({ editedComment: getEditedComment });
							} else {
								issue.message = "Failed to edit!";
							}
						} else {
							issue.message = "Please provide your updated comment!";
						}
					} else {
						if (!doIHaveAccess) {
							issue.spaceId = "You are not a member of the space!!";
						} else {
							issue.commentId = "Unable to perform the operation!";
						}
					}
				} else {
					issue.spaceId = "Not found space";
				}
			} else {
				issue.cardId = "Not found comment";
			}
		} else {
			if (!isValidSpaceId) {
				issue.spaceId = "Invalid space id";
			}
			if (!isValidListId) {
				issue.listId = "Invalid list id";
			}
			if (!isValidCardId) {
				issue.cardId = "Invalid card id";
			}
			if (!isValidCommentId) {
				issue.commentId = "Invalid comment id";
			}
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

exports.commentsDelete = async (req, res, next) => {
	let { spaceId, listId, cardId, commentId } = req.params;

	try {
		const user = req.user;
		const issue = {};

		// check spaceId, listId, cardId, commentId
		const isValidSpaceId = isValidObjectId(spaceId);
		const isValidListId = isValidObjectId(listId);
		const isValidCardId = isValidObjectId(cardId);
		const isValidCommentId = isValidObjectId(commentId);
		if (isValidSpaceId && isValidListId && isValidCardId && isValidCommentId) {
			const getComment = await CommentChat.findOne({ _id: commentId }).select("spaceRef");
			if (getComment) {
				spaceId = getComment.spaceRef;
				const spaceExists = await Space.exists({ _id: spaceId });
				if (spaceExists) {
					const doIHaveAccess = await Space.exists({ $and: [{ _id: spaceId }, { "members.member": user._id }] });
					const doAccessToEdit1 = await CommentChat.exists({ $and: [{ _id: commentId }, { sender: user._id }] });
					if (doIHaveAccess && doAccessToEdit1) {
						const deleteComment = await CommentChat.updateOne(
							{ _id: commentId },
							{
								deleted: true,
							},
						);

						if (deleteComment.modifiedCount) {
							res.json({ message: "Successfully deleted the comment!" });
						} else {
							issue.commentId = "Failed to delete!";
						}
					} else {
						if (!doIHaveAccess) {
							issue.spaceId = "You are not a member of the space!!";
						} else {
							issue.commentId = "Unable to perform the operation!";
						}
					}
				} else {
					issue.spaceId = "Not found space";
				}
			} else {
				issue.cardId = "Not found comment";
			}
		} else {
			if (!isValidSpaceId) {
				issue.spaceId = "Invalid space id";
			}
			if (!isValidListId) {
				issue.listId = "Invalid list id";
			}
			if (!isValidCardId) {
				issue.cardId = "Invalid card id";
			}
			if (!isValidCommentId) {
				issue.commentId = "Invalid comment id";
			}
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};

exports.commentsReaction = async (req, res, next) => {
	let { spaceId, listId, cardId, commentId } = req.params;
	let { reaction } = req.body;

	try {
		const user = req.user;
		const issue = {};

		// check spaceId, listId, cardId, commentId
		const isValidSpaceId = isValidObjectId(spaceId);
		const isValidListId = isValidObjectId(listId);
		const isValidCardId = isValidObjectId(cardId);
		const isValidCommentId = isValidObjectId(commentId);
		if (isValidSpaceId && isValidListId && isValidCardId && isValidCommentId) {
			const getComment = await CommentChat.findOne({ _id: commentId }).select("spaceRef");
			if (getComment) {
				spaceId = getComment.spaceRef;
				const spaceExists = await Space.exists({ _id: spaceId });
				if (spaceExists) {
					const doIHaveAccess = await Space.exists({ $and: [{ _id: spaceId }, { "members.member": user._id }] });
					if (doIHaveAccess) {
						// check the reaction
						let reactionOk;
						if (reaction) {
							reaction = String(reaction).replace(/  +/g, "").trim();
							reactionOk = true;
						} else {
							issue.message = "Please provide your reaction!";
						}

						if (reactionOk) {
							const isAlreadyReacted = await CommentChat.exists({
								$and: [
									{ _id: commentId },
									{
										reactions: {
											$elemMatch: { reactor: user._id },
										},
									},
								],
							});

							let updateReaction;
							if (isAlreadyReacted) {
								// Update reaction
								updateReaction = await CommentChat.updateOne(
									{
										$and: [{ _id: commentId }, { "reactions.reactor": user._id }],
									},
									{ $set: { "reactions.$.reaction": reaction } },
								);
							} else {
								// Push reaction
								updateReaction = await CommentChat.updateOne(
									{ _id: commentId },
									{
										$push: {
											reactions: {
												reactor: user._id,
												reaction,
											},
										},
									},
								);
							}

							if (updateReaction.modifiedCount) {
								const getReactions = await CommentChat.findOne({ _id: commentId }).select("reactions").populate({
									path: "reactions.reactor",
									select: "fullName username avatar",
								});
								res.json({ reactions: getReactions.reactions });
							} else {
								issue.message = "Failed to react!";
							}
						}
					} else {
						issue.spaceId = "You are not a member of the space!!";
					}
				} else {
					issue.spaceId = "Not found space";
				}
			} else {
				issue.cardId = "Not found comment";
			}
		} else {
			if (!isValidSpaceId) {
				issue.spaceId = "Invalid space id";
			}
			if (!isValidListId) {
				issue.listId = "Invalid list id";
			}
			if (!isValidCardId) {
				issue.cardId = "Invalid card id";
			}
			if (!isValidCommentId) {
				issue.commentId = "Invalid comment id";
			}
		}

		if (!res.headersSent) {
			res.status(400).json({ issue });
		}
	} catch (err) {
		next(err);
	}
};
