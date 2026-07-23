import { QueryTypes } from "sequelize";

import database from "../../database";

/**
 * Linha de `Users` relevante para o fluxo de redefinição de senha. O domínio
 * não tem model próprio: as buscas passam por SQL parametrizado cru (mantido
 * exatamente como após o fix de SQLi). Só usamos o `companyId` no gate de
 * validação do e-mail — os demais SELECTs importam apenas pela contagem.
 */
export interface ForgotPasswordUserRow {
  companyId?: number;
}

/**
 * Único ponto do domínio que toca o banco (doc 04 §3). Não há model: as
 * queries são SQL parametrizado cru e ficam confinadas aqui, fora do service.
 * Os textos SQL e os nomes de placeholder são preservados EXATAMENTE como no
 * código antigo (`SendMail`/`ResetPassword`) para não reabrir a SQLi corrigida.
 */
export class ForgotPasswordRepository {
  /** Busca o usuário pelo e-mail (antigo `filterEmail`). */
  public async findUserByEmail(
    email: string
  ): Promise<ForgotPasswordUserRow[]> {
    const sql = `SELECT * FROM "Users"  WHERE email = :email`;

    return database.query<ForgotPasswordUserRow>(sql, {
      replacements: { email },
      type: QueryTypes.SELECT
    });
  }

  /** Grava o token de redefinição no usuário (antigo `insertToken`). */
  public async saveResetToken(email: string, tokenSenha: string): Promise<void> {
    const sql = `UPDATE "Users" SET "resetPassword"= :tokenSenha WHERE email = :email`;

    await database.query(sql, {
      replacements: { email, tokenSenha },
      type: QueryTypes.UPDATE
    });
  }

  /** Usuários com token de redefinição pendente (antigo `filterUser`). */
  public async findUsersWithResetToken(
    email: string
  ): Promise<ForgotPasswordUserRow[]> {
    const sql = `SELECT * FROM "Users"  WHERE email = :email AND "resetPassword" != ''`;

    return database.query<ForgotPasswordUserRow>(sql, {
      replacements: { email },
      type: QueryTypes.SELECT
    });
  }

  /** Confere e-mail + token (antigo `sqlValida` de `insertHasPassword`). */
  public async findUserByEmailAndToken(
    email: string,
    token: string
  ): Promise<ForgotPasswordUserRow[]> {
    const sql = `SELECT * FROM "Users"  WHERE email = :email AND "resetPassword" = :token`;

    return database.query<ForgotPasswordUserRow>(sql, {
      replacements: { email, token },
      type: QueryTypes.SELECT
    });
  }

  /**
   * Grava o novo hash e limpa o token (antigo UPDATE de `insertHasPassword`).
   * A condição `"resetPassword" = :token` garante que só atualiza quando o
   * token confere.
   */
  public async updatePassword(
    email: string,
    token: string,
    convertPassword: string
  ): Promise<void> {
    const sql = `UPDATE  "Users"  SET "passwordHash"= :convertPassword , "resetPassword" = '' WHERE email= :email AND "resetPassword" = :token`;

    await database.query(sql, {
      replacements: { email, token, convertPassword },
      type: QueryTypes.UPDATE
    });
  }
}
