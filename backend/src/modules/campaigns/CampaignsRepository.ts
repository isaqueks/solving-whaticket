import { Op, QueryTypes, col, fn, where, Filterable } from "sequelize";
import { isEmpty } from "lodash";
import moment from "moment";

import sequelize from "../../database";
// Models de outros domínios usados APENAS em includes/joins nomeados deste
// repository (doc 04 §3, exceção pragmática) — nunca vazam para o service.
import Company from "../companies/models/Company";
import ContactList from "../contact-lists/models/ContactList";
import ContactListItem from "../contact-lists/models/ContactListItem";
import Whatsapp from "../whatsapp/models/Whatsapp";

import Campaign from "./models/Campaign";
import CampaignSetting from "./models/CampaignSetting";
import CampaignShipping from "./models/CampaignShipping";

/** Atributos persistíveis de Campaign (subset gravado pelos casos de uso). */
export interface CampaignWritableAttributes {
  name?: string;
  status?: string;
  confirmation?: boolean;
  scheduledAt?: string | Date;
  completedAt?: Date | moment.Moment;
  companyId?: number;
  contactListId?: number;
  message1?: string;
  message2?: string;
  message3?: string;
  message4?: string;
  message5?: string;
  confirmationMessage1?: string;
  confirmationMessage2?: string;
  confirmationMessage3?: string;
  confirmationMessage4?: string;
  confirmationMessage5?: string;
  fileListId?: number;
  mediaPath?: string | null;
  mediaName?: string | null;
}

/** Atributos persistíveis de CampaignShipping (fluxo de disparo). */
export interface CampaignShippingWritableAttributes {
  jobId?: string | number;
  number?: string;
  message?: string;
  confirmationMessage?: string;
  confirmation?: boolean | null;
  contactId?: number;
  campaignId?: number;
  confirmationRequestedAt?: Date | moment.Moment;
  confirmedAt?: Date | moment.Moment;
  deliveredAt?: Date | moment.Moment;
}

export interface PagedCampaignsQuery {
  companyId: number | string;
  searchParam?: string;
  limit: number;
  offset: number;
}

export interface PagedCampaignsResult {
  records: Campaign[];
  count: number;
}

/** Linha da consulta de campanhas programadas (poller VerifyCampaigns). */
export interface UpcomingCampaignRow {
  id: number;
  scheduledAt: string;
}

/**
 * Único ponto de acesso aos models do agregado de campanhas (doc 04 §3):
 * Campaign, CampaignSetting e CampaignShipping. Não emite socket nem lança
 * erro de negócio — retorna dados/null e o service decide.
 */
export class CampaignsRepository {
  // ── Campaign ───────────────────────────────────────────────────────────────

  public async findById(id: number | string): Promise<Campaign | null> {
    return Campaign.findByPk(id);
  }

  /**
   * Campanha com o contexto completo de disparo (antigo getCampaign dos jobs):
   * lista de contatos válidos no WhatsApp, conexão e remessas com contato.
   */
  public async findByIdWithDispatchContext(
    id: number
  ): Promise<Campaign | null> {
    return Campaign.findByPk(id, {
      include: [
        {
          model: ContactList,
          as: "contactList",
          attributes: ["id", "name"],
          include: [
            {
              model: ContactListItem,
              as: "contacts",
              attributes: ["id", "name", "number", "email", "isWhatsappValid"],
              where: { isWhatsappValid: true }
            }
          ]
        },
        {
          model: Whatsapp,
          as: "whatsapp",
          attributes: ["id", "name"]
        },
        {
          model: CampaignShipping,
          as: "shipping",
          include: [{ model: ContactListItem, as: "contact" }]
        }
      ]
    });
  }

  /**
   * Campanha "lite" para os jobs por contato (antigo getCampaignLite): só os
   * escalares + whatsapp — evita carregar a lista inteira a cada job.
   */
  public async findByIdWithWhatsapp(id: number): Promise<Campaign | null> {
    return Campaign.findByPk(id, {
      include: [
        {
          model: Whatsapp,
          as: "whatsapp",
          attributes: ["id", "name"]
        }
      ]
    });
  }

  /** Leitura detalhada da tela da campanha (antigo ShowService). */
  public async findByIdWithDetails(
    id: number | string
  ): Promise<Campaign | null> {
    return Campaign.findByPk(id, {
      include: [
        { model: CampaignShipping },
        { model: ContactList, include: [{ model: ContactListItem }] },
        { model: Whatsapp, attributes: ["id", "name"] }
      ]
    });
  }

  public async create(
    attributes: CampaignWritableAttributes
  ): Promise<Campaign> {
    // Typings do Sequelize v5 não modelam atributos de criação — cast
    // confinado ao repository (doc 04 §4).
    return Campaign.create(attributes as Partial<Campaign>);
  }

  /** Recarrega com lista e conexão (retorno do create/update originais). */
  public async reloadWithListAndWhatsapp(record: Campaign): Promise<void> {
    await record.reload({
      include: [
        { model: ContactList },
        { model: Whatsapp, attributes: ["id", "name"] }
      ]
    });
  }

  public async updateInstance(
    record: Campaign,
    attributes: CampaignWritableAttributes
  ): Promise<Campaign> {
    return record.update(attributes);
  }

  public async destroy(record: Campaign): Promise<void> {
    await record.destroy();
  }

  /** Listagem paginada por empresa com busca por nome (antigo ListService). */
  public async findAndCountPaged(
    query: PagedCampaignsQuery
  ): Promise<PagedCampaignsResult> {
    const { companyId, searchParam = "", limit, offset } = query;

    let whereCondition: Filterable["where"] = {
      companyId
    };

    if (!isEmpty(searchParam)) {
      whereCondition = {
        ...whereCondition,
        [Op.or]: [
          {
            name: where(
              fn("LOWER", col("Campaign.name")),
              "LIKE",
              `%${searchParam.toLowerCase().trim()}%`
            )
          }
        ]
      };
    }

    const { count, rows: records } = await Campaign.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      order: [["name", "ASC"]],
      include: [
        { model: ContactList },
        { model: Whatsapp, attributes: ["id", "name"] }
      ]
    });

    return { records, count };
  }

  /** Lista plana por empresa, com a empresa embutida (antigo FindService). */
  public async findAllByCompanyWithCompany(
    companyId: string
  ): Promise<Campaign[]> {
    return Campaign.findAll({
      where: {
        companyId
      },
      include: [{ model: Company, as: "company", attributes: ["id", "name"] }],
      order: [["name", "ASC"]]
    });
  }

  /** Campanhas em andamento com confirmação ligada (hook do wbot). */
  public async findAllInProgressWithConfirmation(
    companyId: number
  ): Promise<Campaign[]> {
    return Campaign.findAll({
      where: { companyId, status: "EM_ANDAMENTO", confirmation: true }
    });
  }

  /**
   * Campanhas PROGRAMADA com disparo na próxima hora (poller VerifyCampaigns).
   * SQL idêntico ao do antigo campaignJobs.
   */
  public async findUpcomingScheduled(): Promise<UpcomingCampaignRow[]> {
    return sequelize.query(
      `select id, "scheduledAt" from "Campaigns" c
    where "scheduledAt" between now() and now() + '1 hour'::interval and status = 'PROGRAMADA'`,
      { type: QueryTypes.SELECT }
    );
  }

  // ── CampaignSetting ────────────────────────────────────────────────────────

  /** Registros completos por empresa (tela de configurações). */
  public async findSettingsByCompany(
    companyId: number
  ): Promise<CampaignSetting[]> {
    return CampaignSetting.findAll({
      where: { companyId }
    });
  }

  /** Pares chave/valor por empresa (leitura dos jobs de disparo). */
  public async findSettingKeyValues(
    companyId: number
  ): Promise<CampaignSetting[]> {
    return CampaignSetting.findAll({
      where: { companyId },
      attributes: ["key", "value"]
    });
  }

  /** findOrCreate + update por (key, companyId) — antigo CreateService. */
  public async upsertSetting(
    key: string,
    value: unknown,
    companyId: number
  ): Promise<CampaignSetting> {
    const [record, created] = await CampaignSetting.findOrCreate({
      where: {
        key,
        companyId
      },
      // Typings do Sequelize v5 não modelam atributos de criação — cast
      // confinado ao repository (doc 04 §4).
      defaults: { key, value, companyId } as Partial<CampaignSetting>
    });

    if (!created) {
      await record.update({ value } as Partial<CampaignSetting>);
    }

    return record;
  }

  // ── CampaignShipping ───────────────────────────────────────────────────────

  /** Remessas entregues da campanha (verificação de finalização). */
  public async countDeliveredShipping(campaignId: number): Promise<number> {
    return CampaignShipping.count({
      where: {
        campaignId,
        deliveredAt: {
          [Op.not]: null
        }
      }
    });
  }

  /** Remessas com job pendente (cancelamento de campanha). */
  public async findShippingsToCancel(
    campaignId: number
  ): Promise<CampaignShipping[]> {
    return CampaignShipping.findAll({
      where: {
        campaignId,
        jobId: { [Op.not]: null },
        deliveredAt: null
      }
    });
  }

  /** findOrCreate por (campanha, contato) — job PrepareContact. */
  public async findOrCreateShipping(
    lookup: { campaignId: number; contactId: number },
    defaults: CampaignShippingWritableAttributes
  ): Promise<[CampaignShipping, boolean]> {
    return CampaignShipping.findOrCreate({
      where: {
        campaignId: lookup.campaignId,
        contactId: lookup.contactId
      },
      // Typings do Sequelize v5 não modelam atributos de criação — cast
      // confinado ao repository (doc 04 §4).
      defaults: defaults as Partial<CampaignShipping>
    });
  }

  /** Remessa com o contato carregado (job DispatchCampaign). */
  public async findShippingByIdWithContact(
    id: number
  ): Promise<CampaignShipping | null> {
    return CampaignShipping.findByPk(id, {
      include: [{ model: ContactListItem, as: "contact" }]
    });
  }

  /** Remessa aguardando confirmação para o número (hook do wbot). */
  public async findShippingPendingConfirmation(
    campaignIds: number[],
    number: string
  ): Promise<CampaignShipping | null> {
    return CampaignShipping.findOne({
      where: { campaignId: { [Op.in]: campaignIds }, number, confirmation: null }
    });
  }

  public async updateShippingInstance(
    record: CampaignShipping,
    attributes: CampaignShippingWritableAttributes
  ): Promise<CampaignShipping> {
    return record.update(attributes);
  }
}
