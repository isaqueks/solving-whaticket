import express from "express";
import isAuth from "../middleware/isAuth";

import * as IntegrationController from "../controllers/IntegrationController";

const integrationRoutes = express.Router();

integrationRoutes.post("/integrationRoutes", IntegrationController.index);

export default integrationRoutes;
