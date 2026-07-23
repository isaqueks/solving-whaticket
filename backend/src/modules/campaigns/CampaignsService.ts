import { isArray, isObject } from "lodash";
import * as Yup from "yup";

import AppError from "../../shared/errors/AppError";
import { SocketEvents } from "../../shared/realtime/events";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";
import { MediaStorageService } from "../../shared/storage/MediaStorageService";
import { logger } from "../../utils/logger";
// Instância Bull importada direto da infra (queues/connection) — o barrel
// src/queues.ts puxa o wiring dos processors e criaria ciclo com este módulo.
import { campaignQueue } from "../../queues/connection";

import { ContactListItemsRepository } from "../contact-lists/ContactListItemsRepository";
import { ContactListsRepository } from "../contact-lists/ContactListsRepository";
import { ContactsRepository } from "../contacts/ContactsRepository";
import { TagsRepository } from "../tags/TagsRepository";
import { TicketsRepository } from "../tickets/TicketsRepository";

import { CreateCampaignDto } from "./dtos/CreateCampaignDto";
import { FindCampaignsFilters } from "./dtos/FindCampaignsFilters";
import {
  ListCampaignsFilters,
  ListCampaignsResult
} from "./dtos/ListCampaignsFilters";
import { SaveCampaignSettingsDto } from "./dtos/SaveCampaignSettingsDto";
import { UpdateCampaignDto } from "./dtos/UpdateCampaignDto";
import Campaign from "./models/Campaign";
import CampaignSetting from "./models/CampaignSetting";
import { CampaignsRepository } from "./CampaignsRepository";

/** Página fixa da listagem (comportamento original do ListService). */
const LIST_PAGE_SIZE = 20;

/**
 * Casos de uso do domínio Campaigns (doc 04 §§2–3). Absorve os arquivos do
 * antigo `services/CampaignService/` (List/Create/Show/Update/Delete/Find/
 * Cancel/Restart), os dois de `CampaignSettingServices/` e os handlers
 * `mediaUpload`/`deleteMedia` + fluxo tag→lista do controller antigo. O
 * `FindAllService` legado era código morto (sem importadores) e não foi
 * trazido.
 *
 * Eventos de domínio emitidos via RealtimeGateway (nunca `io.to` direto).
 */
export class CampaignsService {
  constructor(
    private readonly repository = new CampaignsRepository(),
    private readonly contactListsRepository = new ContactListsRepository(),
    private readonly contactListItemsRepository = new ContactListItemsRepository(),
    private readonly contactsRepository = new ContactsRepository(),
    private readonly tagsRepository = new TagsRepository(),
    private readonly ticketsRepository = new TicketsRepository(),
    private readonly realtime: RealtimeGateway = realtimeGateway,
    private readonly mediaStorage = new MediaStorageService()
  ) {}

  public async list(filters: ListCampaignsFilters): Promise<ListCampaignsResult> {
    const { companyId, searchParam = "", pageNumber = "1" } = filters;
    const limit = LIST_PAGE_SIZE;
    const offset = limit * (+pageNumber - 1);

    const { records, count } = await this.repository.findAndCountPaged({
      companyId,
      searchParam,
      limit,
      offset
    });

    const hasMore = count > offset + records.length;

    return { records, count, hasMore };
  }

  public async create(dto: CreateCampaignDto): Promise<Campaign> {
    await this.validateName(dto.name);

    const data = { ...dto };
    if (data.scheduledAt != null && data.scheduledAt != "") {
      data.status = "PROGRAMADA";
    }

    const record = await this.repository.create(data);
    await this.repository.reloadWithListAndWhatsapp(record);

    this.emitCampaignEvent(dto.companyId, { action: "create", record });

    return record;
  }

  /**
   * Criação a partir de uma tag (fluxo do POST /campaigns com `tagListId`
   * numérico): gera uma lista de contatos com os contatos dos tickets da tag
   * e cria a campanha apontando para ela. Comportamento do controller antigo
   * preservado (nome da lista, isWhatsappValid=true, propagação do erro).
   */
  public async createFromTag(
    dto: CreateCampaignDto,
    tagId: number
  ): Promise<Campaign> {
    const contactListId = await this.createContactListFromTag(
      tagId,
      dto.name,
      dto.companyId
    );

    return this.create({ ...dto, contactListId });
  }

  public async show(id: number | string): Promise<Campaign> {
    const record = await this.repository.findByIdWithDetails(id);

    if (!record) {
      // Código de erro herdado do ShowService original (o frontend o traduz).
      throw new AppError("ERR_NO_TICKETNOTE_FOUND", 404);
    }

    return record;
  }

  /**
   * `companyId` separado do dto: o payload persistido é o corpo da requisição
   * (como no UpdateService original) e o evento sai para a empresa do usuário
   * autenticado (como no controller original).
   */
  public async update(
    dto: UpdateCampaignDto,
    companyId: number
  ): Promise<Campaign> {
    // O UpdateService original não revalidava o nome (só o create valida).
    const record = await this.repository.findById(dto.id);

    if (!record) {
      throw new AppError("ERR_NO_CAMPAIGN_FOUND", 404);
    }

    if (["INATIVA", "PROGRAMADA", "CANCELADA"].indexOf(dto.status) === -1) {
      throw new AppError(
        "Só é permitido alterar campanha Inativa e Programada",
        400
      );
    }

    const data = { ...dto };
    if (
      data.scheduledAt != null &&
      data.scheduledAt != "" &&
      data.status === "INATIVA"
    ) {
      data.status = "PROGRAMADA";
    }

    await this.repository.updateInstance(record, data);
    await this.repository.reloadWithListAndWhatsapp(record);

    this.emitCampaignEvent(companyId, { action: "update", record });

    return record;
  }

  public async delete(id: string, companyId: number): Promise<void> {
    const record = await this.repository.findById(id);

    if (!record) {
      throw new AppError("ERR_NO_CAMPAIGN_FOUND", 404);
    }

    if (record.status === "EM_ANDAMENTO") {
      throw new AppError("Não é permitido excluir campanha em andamento", 400);
    }

    await this.repository.destroy(record);

    this.emitCampaignEvent(companyId, { action: "delete", id });
  }

  public async find(params: FindCampaignsFilters): Promise<Campaign[]> {
    return this.repository.findAllByCompanyWithCompany(params.companyId);
  }

  /** Cancela a campanha e remove os jobs Bull ainda não disparados. */
  public async cancel(id: number): Promise<void> {
    const campaign = await this.repository.findById(id);
    await this.repository.updateInstance(campaign, { status: "CANCELADA" });

    const recordsToCancel = await this.repository.findShippingsToCancel(
      campaign.id
    );

    const promises = [];

    for (const record of recordsToCancel) {
      const job = await campaignQueue.getJob(+record.jobId);
      if (job) {
        promises.push(job.remove());
      }
    }

    await Promise.all(promises);
  }

  /** Reinicia os disparos (job ProcessCampaign com delay fixo de 3s). */
  public async restart(id: number): Promise<void> {
    const campaign = await this.repository.findById(id);
    await this.repository.updateInstance(campaign, { status: "EM_ANDAMENTO" });

    await campaignQueue.add("ProcessCampaign", {
      id: campaign.id,
      delay: 3000
    });
  }

  public async attachMedia(
    id: number | string,
    file: Express.Multer.File,
    companyId: number
  ): Promise<Campaign> {
    const record = await this.findByIdOrFail(id);
    const storedFileName = this.mediaStorage.saveUpload(file, companyId);

    return this.repository.updateInstance(record, {
      mediaPath: storedFileName,
      mediaName: file.originalname
    });
  }

  public async removeMedia(id: number | string): Promise<Campaign> {
    const record = await this.findByIdOrFail(id);

    if (record.mediaPath) {
      // Convenção de EXCLUSÃO deste domínio (drift, ver MediaStorageService):
      // apaga por `mediaPath` na raiz de `public/`.
      this.mediaStorage.deleteFile(record.mediaPath);
    }

    return this.repository.updateInstance(record, {
      mediaPath: null,
      mediaName: null
    });
  }

  // ── Configurações de campanha (antigo CampaignSettingServices/) ────────────

  public async listSettings(companyId: number): Promise<CampaignSetting[]> {
    return this.repository.findSettingsByCompany(companyId);
  }

  public async saveSettings(
    dto: SaveCampaignSettingsDto,
    companyId: number
  ): Promise<CampaignSetting[]> {
    const settings: CampaignSetting[] = [];

    for (const settingKey of Object.keys(dto.settings)) {
      const rawValue = dto.settings[settingKey];
      const value =
        isArray(rawValue) || isObject(rawValue)
          ? JSON.stringify(rawValue)
          : rawValue;

      const record = await this.repository.upsertSetting(
        settingKey,
        value,
        companyId
      );

      settings.push(record);
    }

    this.realtime.emitToMainChannel(
      companyId,
      SocketEvents.companyCampaignSettings(companyId),
      { action: "create", record: settings }
    );

    return settings;
  }

  // ── Privados ───────────────────────────────────────────────────────────────

  /**
   * Gera a lista de contatos a partir dos tickets marcados com a tag (fluxo
   * absorvido do controller antigo — consultas agora pelos repositories dos
   * domínios donos). Devolve o id da lista criada.
   */
  private async createContactListFromTag(
    tagId: number,
    campaignName: string,
    companyId: number
  ): Promise<number> {
    const currentDate = new Date();
    const formattedDate = currentDate.toISOString();

    try {
      const ticketTags = await this.tagsRepository.findTicketTagsByTagId(tagId);
      const ticketIds = ticketTags.map(ticketTag => ticketTag.ticketId);

      const tickets = await this.ticketsRepository.findAllByIds(ticketIds);
      const contactIds = tickets.map(ticket => ticket.contactId);

      const contacts = await this.contactsRepository.findAllByIds(contactIds);

      const listName = `${campaignName} | TAG: ${tagId} - ${formattedDate}`;
      const contactList = await this.contactListsRepository.create({
        name: listName,
        companyId
      });

      const { id: contactListId } = contactList;

      const contactListItems = contacts.map(contact => ({
        name: contact.name,
        number: contact.number,
        email: contact.email,
        contactListId,
        companyId,
        isWhatsappValid: true
      }));

      await this.contactListItemsRepository.bulkCreate(contactListItems);

      return contactListId;
    } catch (error) {
      logger.error(
        { err: error },
        "Falha ao criar lista de contatos a partir da tag %d",
        tagId
      );
      throw error;
    }
  }

  private async findByIdOrFail(id: number | string): Promise<Campaign> {
    const record = await this.repository.findById(id);

    if (!record) {
      throw new AppError("ERR_NO_CAMPAIGN_FOUND", 404);
    }

    return record;
  }

  /** Validação de negócio do CreateService/UpdateService originais. */
  private async validateName(name: string): Promise<void> {
    const schema = Yup.object().shape({
      name: Yup.string()
        .min(3, "ERR_CAMPAIGN_INVALID_NAME")
        .required("ERR_CAMPAIGN_REQUIRED")
    });

    try {
      await schema.validate({ name });
    } catch (err) {
      throw new AppError(err instanceof Error ? err.message : String(err));
    }
  }

  private emitCampaignEvent(companyId: number, payload: unknown): void {
    this.realtime.emitToMainChannel(
      companyId,
      SocketEvents.companyCampaign(companyId),
      payload
    );
  }
}

// Singleton do domínio: consumido pelos controllers e pelo grupo de jobs.
export const campaignsService = new CampaignsService();
