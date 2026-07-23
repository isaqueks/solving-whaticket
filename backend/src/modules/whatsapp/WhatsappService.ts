import type { WASocket } from "baileys";
import * as Yup from "yup";

import AppError from "../../shared/errors/AppError";
import { logger } from "../../utils/logger";
import { CreateWhatsappDto } from "./dtos/CreateWhatsappDto";
import { ListWhatsappsFilters } from "./dtos/ListWhatsappsFilters";
import { UpdateWhatsappDto } from "./dtos/UpdateWhatsappDto";
import { WhatsappMutationResult } from "./dtos/WhatsappMutationResult";
import Whatsapp from "./models/Whatsapp";
import { WhatsappRepository } from "./WhatsappRepository";

/**
 * Casos de uso do domínio de conexões Whatsapp — o CRUD, NÃO o runtime da
 * sessão wbot (B5). Absorve os antigos `services/WhatsappService/*`
 * (Create/Delete/List/Show/Update + AssociateWhatsappQueue) e os helpers
 * `GetDefaultWhatsApp`, `GetDefaultWhatsAppByUser` e `GetWhatsappWbot`
 * (doc 04 §§2–3). Regras de negócio preservadas exatamente.
 *
 * A emissão dos eventos `company-${id}-whatsapp` fica no WhatsappController
 * (exceção justificada ao doc 04 §7): `update` é compartilhado com o
 * WhatsAppSessionController (B5), que reseta a sessão sem emitir — mover a
 * emissão para cá passaria a emitir naquele fluxo, mudando o comportamento.
 */
export class WhatsappService {
  constructor(private readonly repository = new WhatsappRepository()) {}

  public async create(dto: CreateWhatsappDto): Promise<WhatsappMutationResult> {
    const {
      name,
      status = "OPENING",
      queueIds = [],
      greetingMessage,
      complationMessage,
      outOfHoursMessage,
      ratingMessage,
      companyId,
      token = "",
      provider = "beta",
      transferQueueId,
      timeToTransfer,
      promptId,
      maxUseBotQueues = 3,
      timeUseBotQueues = 0,
      expiresTicket = 0,
      expiresInactiveMessage = ""
    } = dto;

    await this.ensureConnectionLimit(companyId);

    await this.validateCreate({ name, status, isDefault: dto.isDefault });

    // A conexão só é padrão se for a primeira da empresa (regra original).
    const whatsappFound = await this.repository.findFirstByCompany(companyId);
    const isDefault = !whatsappFound;

    let oldDefaultWhatsapp: Whatsapp | null = null;

    if (isDefault) {
      oldDefaultWhatsapp = await this.repository.findDefaultByCompany(companyId);
      if (oldDefaultWhatsapp) {
        await this.repository.update(oldDefaultWhatsapp, {
          isDefault: false,
          companyId
        });
      }
    }

    if (queueIds.length > 1 && !greetingMessage) {
      throw new AppError("ERR_WAPP_GREETING_REQUIRED");
    }

    if (token !== null && token !== "") {
      await this.validateToken(token);
    }

    const whatsapp = await this.repository.create({
      name,
      status,
      greetingMessage,
      complationMessage,
      outOfHoursMessage,
      ratingMessage,
      isDefault,
      companyId,
      token,
      provider,
      transferQueueId,
      timeToTransfer,
      promptId,
      maxUseBotQueues,
      timeUseBotQueues,
      expiresTicket,
      expiresInactiveMessage
    });

    await this.repository.associateQueues(whatsapp, queueIds);

    return { whatsapp, oldDefaultWhatsapp };
  }

  public async update(dto: UpdateWhatsappDto): Promise<WhatsappMutationResult> {
    const { whatsappData, whatsappId, companyId } = dto;

    const {
      name,
      status,
      isDefault,
      session,
      greetingMessage,
      complationMessage,
      outOfHoursMessage,
      ratingMessage,
      queueIds = undefined,
      token,
      transferQueueId,
      timeToTransfer,
      promptId,
      maxUseBotQueues,
      timeUseBotQueues,
      expiresTicket,
      expiresInactiveMessage
    } = whatsappData;

    await this.validateUpdate({ name, status, isDefault });

    if (queueIds?.length > 1 && !greetingMessage) {
      throw new AppError("ERR_WAPP_GREETING_REQUIRED");
    }

    let oldDefaultWhatsapp: Whatsapp | null = null;

    if (isDefault) {
      oldDefaultWhatsapp = await this.repository.findDefaultByCompanyExcept(
        whatsappId,
        companyId
      );
      if (oldDefaultWhatsapp) {
        await this.repository.update(oldDefaultWhatsapp, { isDefault: false });
      }
    }

    const whatsapp = await this.show(whatsappId, companyId);

    await this.repository.update(whatsapp, {
      name,
      status,
      session,
      greetingMessage,
      complationMessage,
      outOfHoursMessage,
      ratingMessage,
      isDefault,
      companyId,
      token,
      transferQueueId,
      timeToTransfer,
      promptId,
      maxUseBotQueues,
      timeUseBotQueues,
      expiresTicket,
      expiresInactiveMessage
    });

    if (queueIds) {
      await this.repository.associateQueues(whatsapp, queueIds);
    }

    return { whatsapp, oldDefaultWhatsapp };
  }

  public async delete(id: string): Promise<void> {
    const whatsapp = await this.repository.findById(id);

    if (!whatsapp) {
      throw new AppError("ERR_NO_WAPP_FOUND", 404);
    }

    await this.repository.destroy(whatsapp);
  }

  public async show(
    id: string | number,
    companyId: number,
    session?: unknown
  ): Promise<Whatsapp> {
    const whatsapp = await this.repository.findByIdWithQueues(id, session);

    if (whatsapp?.companyId !== companyId) {
      throw new AppError("Não é possível acessar registros de outra empresa");
    }

    if (!whatsapp) {
      throw new AppError("ERR_NO_WAPP_FOUND", 404);
    }

    return whatsapp;
  }

  public async list(filters: ListWhatsappsFilters): Promise<Whatsapp[]> {
    const { companyId, session } = filters;

    return this.repository.findAllByCompany(companyId, session);
  }

  /**
   * Conexão por id sem o blob de sessão, sem checagem de empresa e sem lançar
   * erro (consumo dos módulos tickets/messages — retorna null se não existir).
   */
  public async findByIdWithoutSession(
    id: string | number
  ): Promise<Whatsapp | null> {
    return this.repository.findByIdWithoutSession(id);
  }

  // ── Conexão padrão / wbot (helpers absorvidos na B3) ───────────────────────

  /**
   * Conexão padrão da empresa (ou a do usuário, se conectada), com fallback
   * para qualquer conexão CONNECTED. Reescrito com guard clauses numa rodada
   * anterior — comportamento preservado exatamente.
   */
  public async getDefaultWhatsApp(
    companyId: number,
    userId?: number
  ): Promise<Whatsapp> {
    if (userId) {
      const whatsappByUser = await this.getDefaultWhatsAppByUser(userId);
      if (whatsappByUser?.status === "CONNECTED") {
        return whatsappByUser;
      }

      const connected = await this.repository.findConnectedByCompany(companyId);
      if (!connected) {
        throw new AppError(`ERR_NO_DEF_WAPP_FOUND in COMPANY ${companyId}`);
      }
      return connected;
    }

    const defaultWhatsapp =
      await this.repository.findDefaultConnectableByCompany(companyId);

    if (defaultWhatsapp?.status === "CONNECTED") {
      return defaultWhatsapp;
    }

    const connected = await this.repository.findConnectedByCompany(companyId);
    if (!connected) {
      throw new AppError(`ERR_NO_DEF_WAPP_FOUND in COMPANY ${companyId}`);
    }
    return connected;
  }

  public async getDefaultWhatsAppByUser(
    userId: number
  ): Promise<Whatsapp | null> {
    const user = await this.repository.findUserWithWhatsapp(userId);

    if (user === null || !user.whatsapp) {
      return null;
    }

    logger.info(
      `Found whatsapp linked to user '${user.name}' is '${user.whatsapp.name}'.`
    );

    return user.whatsapp;
  }

  /**
   * Sessão wbot ativa de uma conexão. O acesso ao runtime da sessão
   * (modules/whatsapp-session) usa import tardio para não puxar o grafo do
   * wbot para consumidores puramente CRUD deste service nem criar ciclo de
   * módulos (doc 04 §1: exceção pragmática justificada).
   */
  public async getWhatsappWbot(whatsapp: Whatsapp): Promise<WASocket> {
    const { sessionManager } = await import(
      "../whatsapp-session/SessionManager"
    );
    return sessionManager.getWbot(whatsapp.id);
  }

  // ── Validação (preserva mensagens e regras dos serviços originais) ──────────

  private async ensureConnectionLimit(companyId: number): Promise<void> {
    const company = await this.repository.findCompanyWithPlan(companyId);

    if (company !== null) {
      const whatsappCount = await this.repository.countByCompany(companyId);

      if (whatsappCount >= company.plan.connections) {
        throw new AppError(
          `Número máximo de conexões já alcançado: ${whatsappCount}`
        );
      }
    }
  }

  private async validateCreate(payload: {
    name: string;
    status: string;
    isDefault?: boolean;
  }): Promise<void> {
    const schema = Yup.object().shape({
      name: Yup.string()
        .required()
        .min(2)
        .test(
          "Check-name",
          "Esse nome já está sendo utilizado por outra conexão",
          async value => {
            if (!value) return false;
            const nameExists = await this.repository.findByName(value);
            return !nameExists;
          }
        ),
      isDefault: Yup.boolean().required()
    });

    try {
      await schema.validate(payload);
    } catch (err: any) {
      throw new AppError(err.message);
    }
  }

  private async validateToken(token: string): Promise<void> {
    const tokenSchema = Yup.object().shape({
      token: Yup.string()
        .required()
        .min(2)
        .test(
          "Check-token",
          "This whatsapp token is already used.",
          async value => {
            if (!value) return false;
            const tokenExists = await this.repository.findByToken(value);
            return !tokenExists;
          }
        )
    });

    try {
      await tokenSchema.validate({ token });
    } catch (err: any) {
      throw new AppError(err.message);
    }
  }

  private async validateUpdate(payload: {
    name?: string;
    status?: string;
    isDefault?: boolean;
  }): Promise<void> {
    const schema = Yup.object().shape({
      name: Yup.string().min(2),
      status: Yup.string(),
      isDefault: Yup.boolean()
    });

    try {
      await schema.validate(payload);
    } catch (err: any) {
      throw new AppError(err.message);
    }
  }
}

export const whatsappService = new WhatsappService();
