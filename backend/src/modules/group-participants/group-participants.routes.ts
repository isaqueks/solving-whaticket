import { Router } from "express";

import isAuth from "../../shared/http/middleware/isAuth";
import { GroupParticipantsController } from "./GroupParticipantsController";

/**
 * Rotas do módulo GroupParticipants — mesmos paths/verbos do antigo
 * `routes/groupParticipantRoutes.ts`. Os handlers são arrow properties do
 * controller (convenção do template B1), então passam direto, sem `.bind`.
 */
const groupParticipantRoutes = Router();
const groupParticipantsController = new GroupParticipantsController();

groupParticipantRoutes.get(
  "/contacts/:contactId/participants",
  isAuth,
  groupParticipantsController.index
);

groupParticipantRoutes.post(
  "/contacts/:contactId/participants/sync",
  isAuth,
  groupParticipantsController.sync
);

export default groupParticipantRoutes;
