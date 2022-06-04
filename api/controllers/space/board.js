const { isValidObjectId } = require("mongoose");
const User = require("../../../models/User");
const Space = require("../../../models/Space");
const List = require("../../../models/List");
const Card = require("../../../models/Card");
const Tag = require("../../../models/Tag");
const { multipleFilesCheckAndUpload } = require("../../../utils/file");

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
							const listStructure = new List({
								name,
								spaceRef: spaceId,
								creator: user._id,
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

exports.getList = async (req, res, next) => {
	let { spaceId } = req.params;
	let { skip, limit } = req.query;
	try {
		limit = parseInt(limit) || 20;
		skip = parseInt(skip) || 0;
		const user = req.user;
		const issue = {};

		if (isValidObjectId(spaceId)) {
			const existsSpace = await Space.exists({ _id: spaceId });
			if (existsSpace) {
				const doIHaveAccess = await Space.exists({ $and: [{ _id: spaceId }, { "members.member": user._id }] });
				if (doIHaveAccess) {
					let getLists = await List.find({ spaceRef: spaceId }).sort({ createdAt: -1 }).select("name").skip(skip).limit(limit);
					getLists = JSON.parse(JSON.stringify(getLists));
					for (const list of getLists) {
						const getCards = await Card.find({ listRef: list._id }).select("name description progress tags startDate endDate spaceRef listRef").populate({
							path: "tags",
							select: "name color",
						});
						list.cards = getCards;
					}
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
							const isDuplicate = await Card.exists({ $and: [{ listRef: listId }, { name: new RegExp(`^${name}$`, "i") }] });
							if (!isDuplicate) {
								const cardStructure = new Card({
									name,
									spaceRef: existsList.spaceRef,
									listRef: listId,
									creator: user._id,
								});
								const createCard = await cardStructure.save();

								createCard.creator = undefined;
								createCard.tags = undefined;
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
exports.getDataOfSingleCard = async (req, res, next) => {
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
						const getCard = await Card.findOne({ _id: cardId })
							.select("-createdAt -updatedAt -creator")
							.populate([
								{
									path: "tags",
									select: "name color",
								},
								{
									path: "assignee",
									select: "fullName username avatar",
								},
							]);

						return res.json({ card: getCard });
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
	let { name, description, progress, tagId, startDate, endDate, assignUser, removeAttachmentUrl } = req.body;

	try {
		let nameOk, descriptionOk, progressOk, tagIdOk, startDateOk, endDateOk, assignUserOk;
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
						if (progress) {
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
							if (isValidObjectId(assignUser)) {
								const userExists = await User.exists({ _id: assignUser });
								if (userExists) {
									const assignUserExistsInSpace = await Space.exists({ $and: [{ _id: cardExists.spaceRef }, { "members.member": assignUser }] });
									if (assignUserExistsInSpace) {
										const theUserAlreadyAssignee = await Card.exists({ $and: [{ _id: cardId }, { assignee: assignUser }] });
										if (!theUserAlreadyAssignee) {
											assignUserOk = true;
										} else {
											issue.assignUser = "Tried assign users is already assigned to the Card!";
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

						// update
						if (nameOk && descriptionOk && progressOk && tagIdOk && startDateOk && endDateOk && assignUserOk) {
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
										$push: {
											tags: tagId,
											assignee: assignUser,
											attachments: attachmentsUrl,
										},
										$pull: { attachments: removeAttachmentUrl },
									}
								);

								const card = await Card.findOne({ _id: cardId })
									.select("-createdAt -updatedAt -creator")
									.populate([
										{
											path: "tags",
											select: "name color",
										},
										{
											path: "assignee",
											select: "fullName username avatar",
										},
									]);

								return res.json({ updatedCard: card });
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
