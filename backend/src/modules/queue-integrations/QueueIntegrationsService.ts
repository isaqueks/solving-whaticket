import * as Yup from "yup";

import AppError from "../../shared/errors/AppError";
import { SocketEvents } from "../../shared/realtime/events";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";
import { CreateQueueIntegrationDto } from "./dtos/CreateQueueIntegrationDto";
import {
  ListQueueIntegrationsFilters,
  ListQueueIntegrationsResult
} from "./dtos/ListQueueIntegrationsFilters";
import { UpdateQueueIntegrationDto } from "./dtos/UpdateQueueIntegrationDto";
import QueueIntegrations from "./models/QueueIntegrations";
import { QueueIntegrationsRepository } from "./QueueIntegrationsRepository";

/** Página fixa da listagem (comportamento original do ListService). */
const LIST_PAGE_SIZE = 20;

/**
 * Casos de uso do domínio QueueIntegrations (doc 04 §§2–3). Absorve os 5
 * arquivos do antigo `services/QueueIntegrationServices/`. Regras e códigos
 * de erro preservados (ERR_NO_DIALOG_FOUND é o código estável herdado da era
 * Dialogflow — o frontend o traduz).
 *
 * Eventos de domínio emitidos via RealtimeGateway (nunca `io.to` direto).
 */
export class QueueIntegrationsService {
  constructor(
    private readonly repository = new QueueIntegrationsRepository(),
    private readonly realtime: RealtimeGateway = realtimeGateway
  ) {}

  public async list(
    filters: ListQueueIntegrationsFilters
  ): Promise<ListQueueIntegrationsResult> {
    const { searchParam = "", pageNumber = "1", companyId } = filters;
    const limit = LIST_PAGE_SIZE;
    const offset = limit * (+pageNumber - 1);

    const { queueIntegrations, count } = await this.repository.findAndCountPaged(
      {
        searchParam,
        companyId,
        limit,
        offset
      }
    );

    const hasMore = count > offset + queueIntegrations.length;

    return { queueIntegrations, count, hasMore };
  }

  public async create(
    dto: CreateQueueIntegrationDto
  ): Promise<QueueIntegrations> {
    const { name, companyId } = dto;

    const schema = Yup.object().shape({
      name: Yup.string()
        .required()
        .min(2)
        .test(
          "Check-name",
          "This integration name is already used.",
          async value => {
            if (!value) return false;
            const nameExists = await this.repository.findByNameAndCompany(
              value,
              companyId
            );
            return !nameExists;
          }
        )
    });

    try {
      await schema.validate({ ...dto, name });
    } catch (err) {
      throw new AppError(err instanceof Error ? err.message : String(err));
    }

    const queueIntegration = await this.repository.create(dto);

    this.emitQueueIntegrationEvent(companyId, {
      action: "create",
      queueIntegration
    });

    return queueIntegration;
  }

  public async show(
    id: string | number,
    // Mantido na assinatura como no legado (a checagem por empresa era
    // comentada no original e segue fora).
    _companyId?: number
  ): Promise<QueueIntegrations> {
    const integration = await this.repository.findById(id);

    if (!integration) {
      throw new AppError("ERR_NO_DIALOG_FOUND", 404);
    }

    return integration;
  }

  public async update(
    integrationId: string,
    dto: UpdateQueueIntegrationDto,
    companyId: number
  ): Promise<QueueIntegrations> {
    const schema = Yup.object().shape({
      type: Yup.string().min(2),
      name: Yup.string().min(2)
    });

    try {
      await schema.validate(dto);
    } catch (err) {
      throw new AppError(err instanceof Error ? err.message : String(err));
    }

    const integration = await this.show(integrationId, companyId);

    // Destruturação explícita como no legado: só os campos do contrato são
    // gravados (corpo com chaves extras não vaza para o update).
    const {
      type,
      name,
      projectName,
      jsonContent,
      language,
      urlN8N,
      typebotExpires,
      typebotKeywordFinish,
      typebotSlug,
      typebotUnknownMessage,
      typebotDelayMessage,
      typebotKeywordRestart,
      typebotRestartMessage
    } = dto;

    await this.repository.updateInstance(integration, {
      type,
      name,
      projectName,
      jsonContent,
      language,
      urlN8N,
      companyId,
      typebotExpires,
      typebotKeywordFinish,
      typebotSlug,
      typebotUnknownMessage,
      typebotDelayMessage,
      typebotKeywordRestart,
      typebotRestartMessage
    });

    this.emitQueueIntegrationEvent(companyId, {
      action: "update",
      queueIntegration: integration
    });

    return integration;
  }

  public async delete(integrationId: string, companyId: number): Promise<void> {
    const integration = await this.repository.findById(integrationId);

    if (!integration) {
      throw new AppError("ERR_NO_DIALOG_FOUND", 404);
    }

    await this.repository.destroy(integration);

    this.emitQueueIntegrationEvent(companyId, {
      action: "delete",
      integrationId: +integrationId
    });
  }

  private emitQueueIntegrationEvent(
    companyId: number,
    payload: unknown
  ): void {
    this.realtime.emitToMainChannel(
      companyId,
      SocketEvents.companyQueueIntegration(companyId),
      payload
    );
  }
}

// Singleton do domínio — consumido pelo fluxo do wbot (MessageListener/
// ChatbotFlowService) em tempo de chamada, além dos controllers.
export const queueIntegrationsService = new QueueIntegrationsService();
