import { Router } from "express";

import { ForgotPasswordController } from "./ForgotPasswordController";

/**
 * Rotas do módulo ForgotPassword — mesmos paths/verbos do antigo
 * `routes/forgotPasswordRoutes.ts`. Os handlers são arrow properties do
 * controller (convenção do template B1), então passam direto, sem `.bind`.
 *
 * Os shapes de rota (senha na URL) são preservados de propósito: o frontend
 * os chama. A melhoria é trabalho futuro documentado.
 */
const forgotPasswordRoutes = Router();
const forgotPasswordController = new ForgotPasswordController();

forgotPasswordRoutes.post(
  "/forgetpassword/:email",
  forgotPasswordController.store
);

forgotPasswordRoutes.post(
  "/resetpasswords/:email/:token/:password",
  forgotPasswordController.resetPasswords
);

export default forgotPasswordRoutes;
