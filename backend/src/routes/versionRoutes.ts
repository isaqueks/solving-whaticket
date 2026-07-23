import { Router } from "express";

import * as VersionController from "../controllers/VersionController";

const versionRouter = Router();

versionRouter.get("/version", VersionController.index);

export default versionRouter;
