import { Router } from "express";
import * as GroupParticipantController from "../controllers/GroupParticipantController";
import isAuth from "../middleware/isAuth";

const groupParticipantRoutes = Router();

groupParticipantRoutes.get(
  "/contacts/:contactId/participants",
  isAuth,
  GroupParticipantController.index
);

groupParticipantRoutes.post(
  "/contacts/:contactId/participants/sync",
  isAuth,
  GroupParticipantController.sync
);

export default groupParticipantRoutes;

