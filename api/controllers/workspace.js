const Workspace = require("../../models/Workspace");
const Space = require("../../models/Space");

exports.createWorkspace = async (req, res, next) => {
	let { name } = req.body;
	try {
		const user = req.user;
		const issue = {};
		let nameOk;

		// name check
		if (name) {
			const exists = await Workspace.exists({ $and: [{ owner: user._id }, { name: new RegExp(`^${name}$`, "i") }] });
			if (!exists) {
				const letters = /^[A-Za-z0-9\s]+$/;
				name = String(name).replace(/  +/g, " ").trim();
				const validFirstName = name.match(letters);
				if (validFirstName) {
					nameOk = true;
				} else {
					issue.name = "Workspace name is not valid!";
				}
			} else {
				issue.name = "Duplicate workspace name!";
			}
		} else {
			issue.name = "Please enter your workspace name!";
		}

		if (nameOk) {
			const workspaceStructure = new Workspace({
				name,
				owner: user._id,
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
							role: "admin",
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
exports.getWorkspace = async (req, res, next) => {
	let { limit, skip } = req.query;
	try {
		limit = parseInt(limit) || 10;
		skip = parseInt(skip) || 0;
		const user = req.user;
		const getWorkspace = await Workspace.find({ owner: user._id }).sort({ createdAt: -1 }).skip(skip).limit(limit);

		return res.send({ workspaces: getWorkspace });
	} catch (err) {
		next(err);
	}
};
