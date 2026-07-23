import * as Sentry from "@sentry/node";
import { Job } from "bull";
import { QueryTypes } from "sequelize";

import sequelize from "../database";
import { UsersRepository } from "../modules/users/UsersRepository";
import { logger } from "../utils/logger";

/**
 * Processor do job "VerifyLoginStatus" do UserMonitor (antigo
 * queues/userMonitorJobs.ts): derruba para offline usuários sem atividade há
 * mais de 5 minutos. A varredura continua em SQL cru (filtro por intervalo
 * direto no banco, como no original — exceção justificada da fase B6); o
 * acesso por model vai pelo UsersRepository.
 */
export class LoginStatusProcessor {
  constructor(private readonly usersRepository = new UsersRepository()) {}

  public verifyLoginStatus = async (job: Job): Promise<void> => {
    const users: { id: number }[] = await sequelize.query(
      `select id from "Users" where "updatedAt" < now() - '5 minutes'::interval and online = true`,
      { type: QueryTypes.SELECT }
    );
    for (const item of users) {
      try {
        const user = await this.usersRepository.findById(item.id);
        await this.usersRepository.update(user, { online: false });
        logger.info(`Usuário passado para offline: ${item.id}`);
      } catch (e) {
        Sentry.captureException(e);
      }
    }
  };
}

export const loginStatusProcessor = new LoginStatusProcessor();
