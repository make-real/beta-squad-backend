const Workspace = require("../../models/Workspace");
const Space = require("../../models/Space");

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
				const exists = await Workspace.exists({ $and: [{ owner: user._id }, { name: new RegExp(`^${name}$`, "i") }] });
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
