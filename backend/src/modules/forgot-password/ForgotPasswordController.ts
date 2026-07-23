import { Request, Response } from "express";

import { ForgotPasswordService } from "./ForgotPasswordService";

/**
 * Controller fino (doc 04 §3): lê os params, delega ao service e traduz o
 * resultado para os status/mensagens HTTP originais do fluxo de senha.
 *
 * Convenção do template (B1): handlers são ARROW PROPERTIES — `this` fica
 * preso à instância e o arquivo de rotas passa o método direto, sem `.bind`.
 *
 * Nota: os paths `POST /forgetpassword/:email` e
 * `POST /resetpasswords/:email/:token/:password` são conhecidamente ruins
 * (senha na URL), mas são mantidos porque o frontend os chama — a melhoria
 * está documentada como trabalho futuro.
 */
export class ForgotPasswordController {
  constructor(private readonly service = new ForgotPasswordService()) {}

  public store = async (req: Request, res: Response): Promise<Response> => {
    const { email } = req.params;

    const sent = await this.service.sendResetEmail({ email });
    if (sent) {
      return res.status(200).json({ message: "E-mail enviado com sucesso" });
    }

    return res.status(404).json({ error: "E-mail não encontrado" });
  };

  public resetPasswords = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { email, token, password } = req.params;

    const reset = await this.service.resetPassword({ email, token, password });
    if (reset) {
      return res.status(200).json({ message: "Senha redefinida com sucesso" });
    }

    return res.status(404).json({ error: "Verifique o Token informado" });
  };
}
