const spaceFileRouter = require("express").Router({ mergeParams: true });
const { contentPermission } = require("../../../middleware/authorize");

const { addSpaceFile, getSpaceFiles, getSingleSpaceFile, updateSpaceFile, deleteSpaceFile } = require("../../controllers/space/spaceFile");

spaceFileRouter.post("/", contentPermission(["owner", "admin", "user"]), addSpaceFile);
spaceFileRouter.get("/", getSpaceFiles);
spaceFileRouter.get("/:spaceFileId", getSingleSpaceFile);
spaceFileRouter.patch("/:spaceFileId", contentPermission(["owner", "admin", "user"]), updateSpaceFile);
spaceFileRouter.delete("/:spaceFileId", contentPermission(["owner", "admin", "user"]), deleteSpaceFile);

module.exports = spaceFileRouter;
