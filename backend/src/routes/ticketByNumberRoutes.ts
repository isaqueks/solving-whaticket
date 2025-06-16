import express from "express";
import isAuth from "../middleware/isAuth";
import { GetTickerByNumberController } from "../controllers/GetTicketByNumberController";

const getTicketByNumberRoutes = express.Router();

const controller = new GetTickerByNumberController();

getTicketByNumberRoutes.get("/ticket-by-number", isAuth, controller.get);



export default getTicketByNumberRoutes;
