import express from "express";

import isAuth from "../../shared/http/middleware/isAuth";
import { TicketsController } from "./TicketsController";

/**
 * Rotas do módulo Tickets — mesmos paths/verbos dos antigos
 * `routes/ticketRoutes.ts`, `routes/ticketByNumberRoutes.ts` e da rota
 * administrativa GET /fixTickets (antes inline no routes/index.ts).
 */
const ticketsRoutes = express.Router();
const ticketsController = new TicketsController();

ticketsRoutes.get("/tickets", isAuth, ticketsController.index);

ticketsRoutes.get("/tickets/:ticketId", isAuth, ticketsController.show);

ticketsRoutes.get("/ticket/kanban", isAuth, ticketsController.kanban);

ticketsRoutes.get("/tickets/u/:uuid", isAuth, ticketsController.showFromUUID);

ticketsRoutes.post("/tickets", isAuth, ticketsController.store);

ticketsRoutes.put("/tickets/:ticketId", isAuth, ticketsController.update);

ticketsRoutes.delete("/tickets/:ticketId", isAuth, ticketsController.remove);

ticketsRoutes.get("/ticket-by-number", isAuth, ticketsController.getByNumber);

ticketsRoutes.get("/fixTickets", isAuth, ticketsController.fixTickets);

export default ticketsRoutes;
