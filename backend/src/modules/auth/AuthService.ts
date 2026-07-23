import { sign } from "jsonwebtoken";

import { appConfig } from "../../config/AppConfig";
import { logger } from "../../utils/logger";
import AppError from "../../shared/errors/AppError";
import { SocketEvents } from "../../shared/realtime/events";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";
import User from "../users/models/User";
import {
  SerializedUser,
  SerializeUser
} from "../users/serializers/SerializeUser";
import { UsersRepository } from "../users/UsersRepository";
import { UsersService } from "../users/UsersService";
import { LoginDto, LoginResult } from "./dtos/LoginDto";
import {
  AccessTokenPayload,
  RefreshTokenPayload
} from "./dtos/TokenPayloads";

/**
 * Validades dos JWTs legados (valores do antigo `config/auth.ts`, agora
 * absorvido aqui — os secrets continuam vindo de `appConfig.auth`).
 */
const ACCESS_TOKEN_EXPIRES_IN = "15m";
const REFRESH_TOKEN_EXPIRES_IN = "7d";

/**
 * Casos de uso de sessão (doc 04 §§2–3). Absorve o antigo
 * `services/UserServices/AuthUserService.ts` e a criação de tokens do antigo
 * `helpers/CreateTokens.ts` (métodos privados — decisão B2: uma TokenFactory
 * separada seria classe com dois métodos puros e um único consumidor, doc 04
 * §11).
 *
 * Nota de arquitetura: os JWTs emitidos aqui são VESTIGIAIS — a autenticação
 * real das requisições é o cookie `user` validado contra o SSO externo
 * (shared/http/middleware/isAuth.ts). O par token/refreshToken continua sendo
 * emitido no login por compatibilidade com o frontend e integrações.
 *
 * O módulo não possui models próprios: User pertence a modules/users e todo
 * acesso passa pelo UsersRepository (DoD 3 — único ponto de acesso do domínio).
 */
export class AuthService {
  constructor(
    private readonly usersRepository = new UsersRepository(),
    private readonly usersService = new UsersService(),
    private readonly realtime: RealtimeGateway = realtimeGateway
  ) {}

  public async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.usersRepository.findByEmailForAuth(dto.email);

    if (!user) {
      throw new AppError("ERR_INVALID_CREDENTIALS", 401);
    }

    if (!(await user.checkPassword(dto.password))) {
      throw new AppError("ERR_INVALID_CREDENTIALS", 401);
    }

    const token = this.createAccessToken(user);
    const refreshToken = this.createRefreshToken(user);

    const serializedUser = await SerializeUser(user);

    this.emitAuthEvent(serializedUser);

    return { serializedUser, token, refreshToken };
  }

  /** Usuário autenticado (GET /auth/me) — delega ao caso de uso de Users. */
  public async currentUser(id: string | number): Promise<User> {
    return this.usersService.show(id);
  }

  public async logout(id: string | number): Promise<void> {
    const user = await this.usersRepository.findById(id);

    // Correção aprovada: logout nunca deve estourar 500 por usuário
    // inexistente. Se o usuário sumiu (ex.: apagado durante a sessão), o
    // controller ainda limpa o cookie e conclui o logout — apenas logamos.
    if (!user) {
      logger.warn(
        `logout: user ${id} not found; clearing session cookie anyway`
      );
      return;
    }

    await this.usersRepository.update(user, { online: false });
  }

  private createAccessToken(user: User): string {
    const payload: AccessTokenPayload = {
      // "usarname" (sic): chave EXATA do token original — ver dtos/TokenPayloads.
      usarname: user.name,
      profile: user.profile,
      id: user.id,
      companyId: user.companyId
    };

    return sign(payload, appConfig.auth.jwtSecret, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN
    });
  }

  private createRefreshToken(user: User): string {
    const payload: RefreshTokenPayload = {
      id: user.id,
      tokenVersion: user.tokenVersion,
      companyId: user.companyId
    };

    return sign(payload, appConfig.auth.jwtRefreshSecret, {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN
    });
  }

  /** Evento de sessão atualizada para a sala individual do usuário logado. */
  private emitAuthEvent(user: SerializedUser): void {
    this.realtime.emitToUser(
      user.id,
      SocketEvents.companyAuth(user.companyId),
      {
        action: "update",
        user: { id: user.id, email: user.email, companyId: user.companyId }
      }
    );
  }
}
