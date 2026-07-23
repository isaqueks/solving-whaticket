import { Router } from "express";

import isAuth from "../../shared/http/middleware/isAuth";
import { ChatsController } from "./ChatsController";

/**
 * Rotas do módulo Chat interno — mesmos paths/verbos do antigo
 * `routes/chatRoutes.ts`. Os handlers são arrow properties do controller
 * (convenção do template B1), então podem ser passados direto, sem `.bind`.
 */
const chatRoutes = Router();
const chatsController = new ChatsController();

chatRoutes.get("/chats", isAuth, chatsController.index);

chatRoutes.get("/chats/:id", isAuth, chatsController.show);

chatRoutes.get("/chats/:id/messages", isAuth, chatsController.messages);

chatRoutes.post("/chats/:id/messages", isAuth, chatsController.saveMessage);

chatRoutes.post("/chats/:id/read", isAuth, chatsController.checkAsRead);

chatRoutes.post("/chats", isAuth, chatsController.store);

chatRoutes.put("/chats/:id", isAuth, chatsController.update);

chatRoutes.delete("/chats/:id", isAuth, chatsController.remove);

export default chatRoutes;
