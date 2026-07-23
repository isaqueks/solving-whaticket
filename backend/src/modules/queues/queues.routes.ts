import { Router } from "express";
import multer from "multer";

import uploadConfig from "../../config/upload";
import isAuth from "../../shared/http/middleware/isAuth";
import { QueueOptionsController } from "./QueueOptionsController";
import { QueuesController } from "./QueuesController";

/**
 * Rotas do módulo Queues — mesmos paths/verbos dos antigos
 * `routes/queueRoutes.ts` e `routes/queueOptionRoutes.ts`, reunidos aqui.
 *
 * Um único arquivo para os dois sub-recursos: Queues e QueueOptions são um só
 * domínio (a fila é dona das suas opções; os models moram juntos em
 * `modules/queues/models/`), espelhando o que Tags fez com ticket-tags. Um
 * único mount em `routes/index.ts` substitui os dois anteriores.
 *
 * Handlers são arrow properties dos controllers (convenção do template B1),
 * passados direto sem `.bind`.
 */
const upload = multer(uploadConfig);

const queueRoutes = Router();
const queuesController = new QueuesController();
const queueOptionsController = new QueueOptionsController();

// ── Queues (setores de atendimento) ─────────────────────────────────────────
queueRoutes.get("/queue", isAuth, queuesController.index);

queueRoutes.post("/queue", isAuth, queuesController.store);

queueRoutes.get("/queue/:queueId", isAuth, queuesController.show);

queueRoutes.put("/queue/:queueId", isAuth, queuesController.update);

queueRoutes.delete("/queue/:queueId", isAuth, queuesController.remove);

queueRoutes.post(
  "/queue/:queueId/media-upload",
  isAuth,
  upload.array("file"),
  queuesController.mediaUpload
);

queueRoutes.delete(
  "/queue/:queueId/media-upload",
  isAuth,
  queuesController.deleteMedia
);

// ── QueueOptions (nós do chatbot da fila) ────────────────────────────────────
queueRoutes.get("/queue-options", isAuth, queueOptionsController.index);

queueRoutes.post("/queue-options", isAuth, queueOptionsController.store);

queueRoutes.get(
  "/queue-options/:queueOptionId",
  isAuth,
  queueOptionsController.show
);

queueRoutes.put(
  "/queue-options/:queueOptionId",
  isAuth,
  queueOptionsController.update
);

queueRoutes.delete(
  "/queue-options/:queueOptionId",
  isAuth,
  queueOptionsController.remove
);

queueRoutes.post(
  "/queue-options/:queueOptionId/media-upload",
  isAuth,
  upload.array("file"),
  queueOptionsController.mediaUpload
);

queueRoutes.delete(
  "/queue-options/:queueOptionId/media-upload",
  isAuth,
  queueOptionsController.deleteMedia
);

export default queueRoutes;
