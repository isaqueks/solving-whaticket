import { hash } from "bcryptjs";
import nodemailer from "nodemailer";
import { v4 as uuid } from "uuid";

import { appConfig } from "../../config/AppConfig";
import { logger } from "../../utils/logger";
import { ResetPasswordDto } from "./dtos/ResetPasswordDto";
import { SendResetEmailDto } from "./dtos/SendResetEmailDto";
import { ForgotPasswordRepository } from "./ForgotPasswordRepository";
import { resetPasswordEmailHtml } from "./templates/resetPasswordEmail";

/** Custo do bcrypt no reset (comportamento original de `ResetPassword`). */
const PASSWORD_HASH_ROUNDS = 8;

/**
 * Casos de uso do domínio ForgotPassword (doc 04 §§2–3). Absorve os antigos
 * `ForgotPassWordServices/SendMail` e `ResetPasswordService/ResetPassword`.
 * SQL fica no repository; transporte de e-mail vem de `appConfig.mail`.
 *
 * Cada método retorna um booleano (encontrado/redefinido). O controller
 * traduz para os status/mensagens HTTP originais (200 / 404) — as strings de
 * erro internas do código antigo nunca chegavam ao cliente.
 */
export class ForgotPasswordService {
  constructor(
    private readonly repository = new ForgotPasswordRepository()
  ) {}

  /**
   * Gera um token, grava-o no usuário e dispara o e-mail de redefinição.
   * @returns `true` se o e-mail foi encontrado (→ 200); `false` caso
   * contrário (→ 404 "E-mail não encontrado").
   */
  public async sendResetEmail(dto: SendResetEmailDto): Promise<boolean> {
    const { email } = dto;

    const users = await this.repository.findUserByEmail(email);
    if (users.length === 0) {
      return false;
    }

    const [userData] = users;
    if (!userData || userData.companyId === undefined) {
      return false;
    }

    const token = uuid();
    await this.repository.saveResetToken(email, token);

    // Envio fire-and-forget (comportamento original): a resposta HTTP não
    // espera o SMTP; falha de envio é logada dentro de `deliverEmail`.
    void this.deliverEmail(email, token);

    return true;
  }

  /**
   * Redefine a senha se o par e-mail/token conferir.
   * @returns `true` se a senha foi redefinida (→ 200); `false` se o usuário
   * não tem token pendente ou o token não confere (→ 404 "Verifique o Token
   * informado").
   */
  public async resetPassword(dto: ResetPasswordDto): Promise<boolean> {
    const { email, token, password } = dto;

    const users = await this.repository.findUsersWithResetToken(email);
    if (users.length === 0) {
      return false;
    }

    const convertPassword = await hash(password, PASSWORD_HASH_ROUNDS);

    // Ordem preservada do original: confere o token (SELECT) ANTES do UPDATE,
    // pois o UPDATE zera `resetPassword` e invalidaria a conferência.
    const matched = await this.repository.findUserByEmailAndToken(email, token);
    await this.repository.updatePassword(email, token, convertPassword);

    return matched.length > 0;
  }

  /** Monta o transporte SMTP a partir do `appConfig.mail` (migrado em B0). */
  private buildTransport() {
    return nodemailer.createTransport({
      host: appConfig.mail.host,
      port: appConfig.mail.port,
      secure: true,
      auth: {
        user: appConfig.mail.user,
        pass: appConfig.mail.password
      }
    });
  }

  /** Envia o e-mail de redefinição; erros de SMTP são logados, não propagados. */
  private async deliverEmail(email: string, token: string): Promise<void> {
    try {
      const info = await this.buildTransport().sendMail({
        from: appConfig.mail.from,
        to: email,
        subject: "Redefinição de Senha - PLW Design",
        html: resetPasswordEmailHtml(token)
      });

      logger.info({ response: info.response }, "E-mail de redefinição enviado");
    } catch (err) {
      logger.error({ err }, "Falha ao enviar e-mail de redefinição de senha");
    }
  }
}
