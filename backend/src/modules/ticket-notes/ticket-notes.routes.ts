import { Router } from "express";

import isAuth from "../../shared/http/middleware/isAuth";
import { TicketNotesController } from "./TicketNotesController";

/**
 * Rotas do módulo TicketNotes — mesmos paths/verbos do antigo
 * `routes/ticketNoteRoutes.ts`. Os handlers são arrow properties do controller
 * (convenção do template B1), então podem ser passados direto, sem `.bind`.
 */
const ticketNoteRoutes = Router();
const ticketNotesController = new TicketNotesController();

ticketNoteRoutes.get(
  "/ticket-notes/list",
  isAuth,
  ticketNotesController.findFilteredList
);

ticketNoteRoutes.get("/ticket-notes", isAuth, ticketNotesController.index);

ticketNoteRoutes.get("/ticket-notes/:id", isAuth, ticketNotesController.show);

ticketNoteRoutes.post("/ticket-notes", isAuth, ticketNotesController.store);

ticketNoteRoutes.put("/ticket-notes/:id", isAuth, ticketNotesController.update);

ticketNoteRoutes.delete(
  "/ticket-notes/:id",
  isAuth,
  ticketNotesController.remove
);

export default ticketNoteRoutes;
