import { Router } from "express";
import multer from "multer";

import uploadConfig from "../../config/upload";
import isAuth from "../../shared/http/middleware/isAuth";
import { FilesController } from "./FilesController";

/**
 * Rotas do módulo Files (listas de arquivos) — mesmos paths/verbos e guard
 * (isAuth) do antigo `routes/filesRoutes.ts`. Handlers são arrow properties do
 * controller (convenção do template B1), passados direto sem `.bind`.
 */
const upload = multer(uploadConfig);

const filesRoutes = Router();
const filesController = new FilesController();

filesRoutes.get("/files/list", isAuth, filesController.list);
filesRoutes.get("/files", isAuth, filesController.index);
filesRoutes.post("/files", isAuth, filesController.store);
filesRoutes.put("/files/:fileId", isAuth, filesController.update);
filesRoutes.get("/files/:fileId", isAuth, filesController.show);
filesRoutes.delete("/files/:fileId", isAuth, filesController.remove);
filesRoutes.delete("/files", isAuth, filesController.removeAll);
filesRoutes.post(
  "/files/uploadList/:fileListId",
  isAuth,
  upload.array("files"),
  filesController.uploadMedias
);

export default filesRoutes;
