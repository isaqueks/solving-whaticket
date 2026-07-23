import { Router } from "express";

import { VersionController } from "./VersionController";

/**
 * Rotas do módulo Version — mesmo path/verbo do antigo `routes/versionRoutes.ts`.
 * Endpoint público (sem `isAuth`), como no original. O handler é arrow property
 * do controller (convenção do template B1), então é passado direto, sem `.bind`.
 */
const versionRoutes = Router();
const versionController = new VersionController();

versionRoutes.get("/version", versionController.index);

export default versionRoutes;
