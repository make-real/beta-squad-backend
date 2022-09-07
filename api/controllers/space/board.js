const { isValidObjectId } = require("mongoose");
const User = require("../../../models/User");
const Space = require("../../../models/Space");
const List = require("../../../models/List");
const Card = require("../../../models/Card");
const Checklist = require("../../../models/Checklist");
const CommentChat = require("../../../models/CommentChat");
const Tag = require("../../../models/Tag");
const { multipleFilesCheckAndUpload } = require("../../../utils/file");
const { splitSpecificParts } = require("../../../utils/func");

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
					let getLists = await List.find({ spaceRef: spaceId }).sort({ createdAt: -1 }).select("name").skip(skip).limit(limit);
					if (getCards) {
						getLists = JSON.parse(JSON.stringify(getLists));
						for (const list of getLists) {
							const getCards = await Card.find({ listRef: list._id }).select("name progress tags startDate endDate spaceRef listRef").populate({
								path: "tags",
								select: "name color",
							});
							list.cards = getCards;
						}
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
exports.deleteList = async (req, res, next) => {
	let { spaceId, listId } = req.params;

	try {
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
						const deleteList = await List.deleteOne({ _id: listId });

						if (deleteList.deletedCount) {
							res.json({ message: "Successfully deleted!" });

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

exports.getCards = async (req, res, next) => {
	let { spaceId, listId } = req.params;
	let { skip, limit } = req.query;
	try {
		limit = parseInt(limit) || undefined;
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
						const getCards = await Card.find({ listRef: listId })
							.select("name progress tags startDate endDate spaceRef listRef")
							.populate({
								path: "tags",
								select: "name color",
							})
							.skip(skip)
							.limit(limit);

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
						const getCard = await Card.findOne({ _id: cardId })
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
											path: "checkList",
											select: "content checked spaceRef cardRef assignee",
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

exports.moveCard = async (req, res, next) => {
	let { spaceId, listId, cardId } = req.params;
	let { newListId } = req.body;

	try {
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
						if (newListId) {
							const isValidNewListId = isValidObjectId(newListId);
							if (isValidNewListId) {
								const existsMoveToList = await List.exists({ _id: newListId });
								if (existsMoveToList) {
									const isValidToMoveToNewList = await List.exists({ $and: [{ _id: newListId }, { spaceRef: cardExists.spaceRef }] });
									if (isValidToMoveToNewList) {
										await Card.updateOne(
											{ _id: cardId },
											{
												listRef: newListId,
											}
										);
										const card = await Card.findOne({ _id: cardId }).select("name listRef spaceRef");
										return res.json({ card });
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
						cardExists = JSON.parse(JSON.stringify(cardExists));
						cardExists._id = undefined;
						cardExists.name = name ? name : `Copy of ${cardExists.name}`;

						const newCardOfCopy = new Card({
							creator: user._id,
							...cardExists,
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
			const cardExists = await Card.findOne({ _id: cardId }).select("startDate spaceRef");
			if (cardExists) {
				const existsSpace = await Space.findOne({ _id: cardExists.spaceRef }).select("workSpaceRef");
				if (existsSpace) {
					const doIHaveAccess = await Space.exists({ $and: [{ _id: cardExists.spaceRef }, { "members.member": user._id }] });
					if (doIHaveAccess) {
						const deleteCard = await Card.deleteOne({ _id: cardId });
						if (deleteCard.deletedCount) {
							res.json({ message: "Successfully deleted card!" });
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
								}
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
	let { content, check, assignUser, removeAssignedUser } = req.body;

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
								}
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
							}
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
						path: "seen",
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
								$nor: [{ sender: user._id }, { seen: user._id }],
							},
						],
					},
					{ $push: { seen: user._id } }
				).then();
				// Operation End
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
									path: "seen",
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
										$nor: [{ sender: user._id }, { seen: user._id }],
									},
								],
							},
							{ $push: { seen: user._id } }
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
								}
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
										path: "seen",
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
							}
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
