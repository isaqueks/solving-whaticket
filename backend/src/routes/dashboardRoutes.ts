import express from "express";
import isAuth from "../middleware/isAuth";

import * as DashboardController from "../controllers/DashboardController";

const routes = express.Router();

routes.get("/dashboard", isAuth, DashboardController.index);
routes.get("/dashboard/ticketsUsers", isAuth, DashboardController.reportsUsers);
routes.get("/dashboard/ticketsDay", isAuth, DashboardController.reportsDay);

export default routes;
