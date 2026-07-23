import express from "express";
import isAuth from "../middleware/isAuth";
import { GetTicketByNumberController } from "../controllers/GetTicketByNumberController";

const getTicketByNumberRoutes = express.Router();

const controller = new GetTicketByNumberController();

getTicketByNumberRoutes.get("/ticket-by-number", isAuth, controller.get);



export default getTicketByNumberRoutes;
