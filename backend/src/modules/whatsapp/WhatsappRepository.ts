import { FindOptions } from "sequelize/types";
import { Op } from "sequelize";

import Company from "../companies/models/Company";
import Plan from "../plans/models/Plan";
import Queue from "../queues/models/Queue";
import QueueOption from "../queues/models/QueueOption";
import User from "../users/models/User";
import Whatsapp from "./models/Whatsapp";

/** Atributos persistíveis de Whatsapp (subset gravado por create/update). */
export interface WhatsappWritableAttributes {
  name?: string;
  status?: string;
  session?: string;
  qrcode?: string;
  retries?: number;
  greetingMessage?: string;
  complationMessage?: string;
  outOfHoursMessage?: string;
  ratingMessage?: string;
  isDefault?: boolean;
  companyId?: number;
  token?: string;
  provider?: string;
  transferQueueId?: number;
  timeToTransfer?: number;
  promptId?: number;
  maxUseBotQueues?: number;
  timeUseBotQueues?: number;
  expiresTicket?: number;
  expiresInactiveMessage?: string;
}

/**
 * Único ponto de acesso ao model Whatsapp do domínio (doc 04 §3). Não emite
 * socket nem lança erro de negócio — retorna dados/null e o service decide.
 *
 * Alguns métodos tocam models de OUTROS domínios (Company/Plan, Queue/
 * QueueOption, User): ficam marcados com `TODO(...)` para migrar quando o dono
 * do domínio migrar.
 */
export class WhatsappRepository {
  public async create(
    attributes: WhatsappWritableAttributes
  ): Promise<Whatsapp> {
    return Whatsapp.create(attributes, { include: ["queues"] });
  }

  public async update(
    whatsapp: Whatsapp,
    attributes: WhatsappWritableAttributes
  ): Promise<Whatsapp> {
    await whatsapp.update(attributes);

    return whatsapp;
  }

  public async destroy(whatsapp: Whatsapp): Promise<void> {
    await whatsapp.destroy();
  }

  /** Instância crua por id (usada pelo delete). */
  public async findById(id: string | number): Promise<Whatsapp | null> {
    return Whatsapp.findOne({ where: { id } });
  }

  /** Conexão por id sem o blob de sessão (consumo de outros módulos). */
  public async findByIdWithoutSession(
    id: string | number
  ): Promise<Whatsapp | null> {
    return Whatsapp.findOne({
      where: { id },
      attributes: { exclude: ["session"] }
    });
  }

  public async findByName(name: string): Promise<Whatsapp | null> {
    return Whatsapp.findOne({ where: { name } });
  }

  public async findByToken(token: string): Promise<Whatsapp | null> {
    return Whatsapp.findOne({ where: { token } });
  }

  /** Primeira conexão da empresa — base para decidir a conexão padrão. */
  public async findFirstByCompany(
    companyId: number
  ): Promise<Whatsapp | null> {
    return Whatsapp.findOne({ where: { companyId } });
  }

  public async countByCompany(companyId: number): Promise<number> {
    return Whatsapp.count({ where: { companyId } });
  }

  /** Conexão marcada como padrão na empresa. */
  public async findDefaultByCompany(
    companyId: number
  ): Promise<Whatsapp | null> {
    return Whatsapp.findOne({ where: { isDefault: true, companyId } });
  }

  /** Conexão padrão da empresa que NÃO seja a informada (troca de padrão). */
  public async findDefaultByCompanyExcept(
    whatsappId: string,
    companyId: number
  ): Promise<Whatsapp | null> {
    return Whatsapp.findOne({
      where: {
        isDefault: true,
        id: { [Op.not]: whatsappId },
        companyId
      }
    });
  }

  /** Conexão padrão, sem o blob de sessão (usada por GetDefaultWhatsApp). */
  public async findDefaultConnectableByCompany(
    companyId: number
  ): Promise<Whatsapp | null> {
    return Whatsapp.findOne({
      where: { isDefault: true, companyId },
      attributes: { exclude: ["session"] }
    });
  }

  /** Qualquer conexão CONNECTED da empresa, sem o blob de sessão. */
  public async findConnectedByCompany(
    companyId: number
  ): Promise<Whatsapp | null> {
    return Whatsapp.findOne({
      where: { status: "CONNECTED", companyId },
      attributes: { exclude: ["session"] }
    });
  }

  /** Listagem da empresa com as filas (tela de Conexões). */
  public async findAllByCompany(
    companyId: number,
    session?: number | string
  ): Promise<Whatsapp[]> {
    const options: FindOptions = {
      where: { companyId },
      include: [
        {
          model: Queue,
          as: "queues",
          attributes: ["id", "name", "color", "greetingMessage"]
        }
      ]
    };

    if (session !== undefined && session == 0) {
      options.attributes = { exclude: ["session"] };
    }

    return Whatsapp.findAll(options);
  }

  /** Detalhe da conexão com filas + opções de fila (tela de Conexões). */
  public async findByIdWithQueues(
    id: string | number,
    session?: unknown
  ): Promise<Whatsapp | null> {
    const findOptions: FindOptions = {
      include: [
        {
          model: Queue,
          as: "queues",
          attributes: [
            "id",
            "name",
            "color",
            "greetingMessage",
            "integrationId",
            "promptId",
            "mediaPath",
            "mediaName"
          ],
          include: [{ model: QueueOption, as: "options" }]
        }
      ],
      order: [["queues", "orderQueue", "ASC"]]
    };

    if (session !== undefined && session == 0) {
      findOptions.attributes = { exclude: ["session"] };
    }

    return Whatsapp.findByPk(id, findOptions);
  }

  /** Vincula as filas informadas à conexão (tabela de junção WhatsappQueue). */
  public async associateQueues(
    whatsapp: Whatsapp,
    queueIds: number[]
  ): Promise<void> {
    await whatsapp.$set("queues", queueIds);
    await whatsapp.reload();
  }

  public async reload(whatsapp: Whatsapp): Promise<void> {
    await whatsapp.reload();
  }

  // TODO(B?): Company/Plan são de outro domínio — mover quando o dono migrar.
  public async findCompanyWithPlan(
    companyId: number
  ): Promise<Company | null> {
    return Company.findOne({
      where: { id: companyId },
      include: [{ model: Plan, as: "plan" }]
    });
  }

  // TODO(B?): User é do módulo users — a leitura vive aqui só enquanto o
  // GetDefaultWhatsAppByUser (absorvido na B3) pertencer ao domínio Whatsapp.
  public async findUserWithWhatsapp(userId: number): Promise<User | null> {
    return User.findByPk(userId, {
      include: [
        {
          association: "whatsapp",
          attributes: { exclude: ["session"] }
        }
      ]
    });
  }
}
