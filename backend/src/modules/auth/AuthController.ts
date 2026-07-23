import { Request, Response } from "express";

import AppError from "../../shared/errors/AppError";
import { AuthService } from "./AuthService";
import { LoginDto } from "./dtos/LoginDto";

/**
 * Controller fino (doc 04 §3) das rotas de sessão — absorve o antigo
 * `controllers/SessionController.ts`.
 *
 * Convenção do template (B1): handlers são ARROW PROPERTIES da classe —
 * `this` já fica preso à instância, dispensando `.bind` no arquivo de rotas.
 *
 * Nota: /login NÃO ganha validação Yup no boundary (exceção ao DoD 4,
 * justificada): credenciais ausentes/malformadas já caem no
 * ERR_INVALID_CREDENTIALS 401 do service — introduzir um 400 novo mudaria o
 * contrato de erro do caminho crítico de autenticação.
 */
export class AuthController {
  constructor(private readonly service = new AuthService()) {}

  /** POST /auth/login */
  public store = async (req: Request, res: Response): Promise<Response> => {
    const { email, password } = req.body as LoginDto;

    const { token, serializedUser, refreshToken } = await this.service.login({
      email,
      password
    });

    this.sendRefreshToken(res, refreshToken);

    return res.status(200).json({
      token,
      user: serializedUser
    });
  };

  /** POST /auth/refresh_token — desativado (o SSO externo é quem renova sessão). */
  public update = async (req: Request, res: Response): Promise<Response> => {
    throw new AppError("Deprecated endpoint", 400);
  };

  /** GET /auth/me */
  public me = async (req: Request, res: Response): Promise<Response> => {
    const user = await this.service.currentUser(req.user.id);

    return res.json(user);
  };

  /** DELETE /auth/logout */
  public remove = async (req: Request, res: Response): Promise<Response> => {
    await this.service.logout(req.user.id);

    res.clearCookie("jrt");

    return res.send();
  };

  /**
   * Cookie httpOnly `jrt` com o refresh token legado — absorve o antigo
   * `helpers/SendRefreshToken.ts` (setar cookie é camada HTTP, doc 04 §3).
   */
  private sendRefreshToken(res: Response, token: string): void {
    res.cookie("jrt", token, { httpOnly: true });
  }
}
