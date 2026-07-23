import { FindOptions, Op, Sequelize, WhereOptions } from "sequelize";

import User from "../users/models/User";
import { ContactExtraInfoDto } from "./dtos/ContactExtraInfoDto";
import { ListContactsFilters } from "./dtos/ListContactsFilters";
import { SimpleListContactsFilters } from "./dtos/SimpleListContactsFilters";
import Contact from "./models/Contact";
import ContactCustomField from "./models/ContactCustomField";

/** Página da listagem principal (comportamento original do ListService). */
const LIST_PAGE_SIZE = 30;
/** Página maior quando o filtro de grupo está ativo (comportamento original). */
const LIST_GROUP_PAGE_SIZE = 200;

export interface PagedContactsResult {
  contacts: Contact[];
  count: number;
  limit: number;
  offset: number;
}

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes cache
const MAX_CACHE_SIZE = 5000;

// Caches em ESCOPO DE MÓDULO (não da instância): preservam exatamente a
// semântica do antigo CreateOrUpdateContactService — um único cache por
// processo, compartilhado por todos os chamadores do caminho quente do wbot.
// Stores an entry while keeping the cache bounded. Maps preserve insertion
// order, so when the cap is reached we evict the oldest entries first.
function setCacheItem<T>(
  cache: Map<string, CacheItem<T>>,
  key: string,
  data: T
): void {
  if (!cache.has(key) && cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, { data, timestamp: Date.now() });
}

const lidCache: Map<string, CacheItem<Contact>> = new Map<string, CacheItem<Contact>>();

const numbersCache: Map<string, CacheItem<Contact>> = new Map<string, CacheItem<Contact>>();

/**
 * Único ponto de acesso aos models do domínio (doc 04 §3): Contact e
 * ContactCustomField. Não emite socket nem lança erro de negócio — retorna
 * dados/null e o service decide.
 */
export class ContactsRepository {
  /** Lookup por lidNumber com cache TTL 5min (caminho quente do wbot). */
  public async findByLidNumberCached(
    lidNumber: string,
    companyId: number
  ): Promise<Contact | null> {
    const cacheKey = `${companyId};${lidNumber}`;
    if (lidCache.has(cacheKey)) {
      const cached = lidCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
        return cached.data;
      }
      lidCache.delete(cacheKey); // stale entry, drop it
    }

    const ctt = await Contact.findOne({
      where: {
        lidNumber,
        companyId
      }
    });

    if (ctt) {
      setCacheItem(lidCache, cacheKey, ctt);
    }

    return ctt;
  }

  /**
   * Lookup por lista de variações de número com cache TTL 5min (caminho
   * quente do wbot). Retorna null quando nenhum contato casa.
   */
  public async findByNumbersCached(
    numbers: string[],
    companyId: number
  ): Promise<Contact | null> {
    const cacheKey = `${companyId};${numbers.join(",")}`;

    if (numbersCache.has(cacheKey)) {
      const cached = numbersCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
        return cached.data;
      }
      numbersCache.delete(cacheKey); // stale entry, drop it
    }

    const ctt = await Contact.findOne({
      where: {
        number: {
          [Op.or]: numbers
        },
        companyId
      }
    });

    if (ctt) {
      setCacheItem(numbersCache, cacheKey, ctt);
      return ctt;
    }

    return ctt;
  }

  public async findByNumberAndCompany(
    number: string,
    companyId: number | string
  ): Promise<Contact | null> {
    return Contact.findOne({ where: { number, companyId } });
  }

  /**
   * Contato por QUALQUER uma das variações de número, no escopo da empresa
   * (fluxo ticket-by-number — variações BR com/sem o nono dígito).
   */
  public async findByAnyNumberAndCompany(
    numbers: string[],
    companyId: number
  ): Promise<Contact | null> {
    return Contact.findOne({
      where: {
        number: numbers.length > 1 ? { [Op.or]: numbers } : numbers[0],
        companyId
      }
    });
  }

  /**
   * Contato por QUALQUER uma das variações de número, SEM escopo de empresa —
   * comportamento original do endpoint público de envio por número.
   */
  public async findByAnyNumber(numbers: string[]): Promise<Contact | null> {
    return Contact.findOne({
      where: {
        number: { [Op.in]: numbers }
      }
    });
  }

  public async findById(id: string | number): Promise<Contact | null> {
    return Contact.findOne({ where: { id } });
  }

  /** Contatos pelos ids informados (fluxo campanha-por-tag, B6). */
  public async findAllByIds(ids: number[]): Promise<Contact[]> {
    return Contact.findAll({ where: { id: ids } });
  }

  /** Contato com whatsapp (sem session) e extraInfo — tela de detalhe. */
  public async findByIdWithDetails(
    id: string | number
  ): Promise<Contact | null> {
    return Contact.findByPk(id, {
      include: [
        {
          association: "whatsapp",
          attributes: { exclude: ["session"] }
        },
        "extraInfo"
      ]
    });
  }

  /** Projeção usada pelo fluxo de update (atributos originais preservados). */
  public async findByIdForUpdate(
    id: string | number
  ): Promise<Contact | null> {
    return Contact.findOne({
      where: { id },
      attributes: ["id", "name", "number", "email", "companyId", "profilePicUrl"],
      include: ["extraInfo"]
    });
  }

  public async create(attributes: {
    name: string;
    number: string;
    email: string;
    taxId: string;
    extraInfo: ContactExtraInfoDto[];
    companyId: number;
  }): Promise<Contact> {
    // Typings do sequelize-typescript v5 não aceitam o include no create;
    // comportamento original preservado (cria os extraInfo junto).
    return Contact.create(attributes as Partial<Contact>, {
      include: ["extraInfo"]
    });
  }

  public async findOrCreateByNumber(
    number: string,
    companyId: number,
    defaults: Partial<Contact>
  ): Promise<[Contact, boolean]> {
    return Contact.findOrCreate({
      where: {
        number,
        companyId
      },
      defaults
    });
  }

  public async updateInstance(
    contact: Contact,
    attributes: Partial<Contact>
  ): Promise<Contact> {
    await contact.update(attributes);
    return contact;
  }

  public async save(contact: Contact): Promise<Contact> {
    await contact.save();
    return contact;
  }

  /** Reload com a projeção de resposta do update (forma original). */
  public async reloadForResponse(contact: Contact): Promise<Contact> {
    await contact.reload({
      attributes: ["id", "name", "number", "email", "profilePicUrl"],
      include: ["extraInfo"]
    });
    return contact;
  }

  public async delete(contact: Contact): Promise<void> {
    await contact.destroy();
  }

  public async upsertCustomField(
    info: ContactExtraInfoDto,
    contactId: number
  ): Promise<void> {
    await ContactCustomField.upsert({ ...info, contactId });
  }

  public async deleteCustomField(id: number): Promise<void> {
    await ContactCustomField.destroy({ where: { id } });
  }

  /** Listagem paginada de GET /contacts (query original preservada). */
  public async findAndCountByFilters(
    filters: ListContactsFilters
  ): Promise<PagedContactsResult> {
    const { searchParam = "", pageNumber = "1", companyId, group = "" } = filters;

    const baseWhere = {
      [Op.or]: [
        {
          name: Sequelize.where(
            Sequelize.fn("LOWER", Sequelize.col("name")),
            "LIKE",
            `%${searchParam.toLowerCase().trim()}%`
          )
        },
        { number: { [Op.like]: `%${searchParam.toLowerCase().trim()}%` } },
        { taxId: { [Op.like]: `%${searchParam.toLowerCase().trim()}%` } }
      ],
      companyId: {
        [Op.eq]: companyId
      }
    };

    let limit = LIST_PAGE_SIZE;
    let whereCondition: WhereOptions = baseWhere;
    if (group) {
      limit = LIST_GROUP_PAGE_SIZE;
      // Cast: os typings do Sequelize v5 não expressam operador em coluna
      // booleana dentro do literal (o código antigo driblava com atribuição
      // dinâmica não tipada) — a query gerada é idêntica.
      whereCondition = {
        ...baseWhere,
        isGroup: { [Op.eq]: group === "true" }
      } as WhereOptions;
    }

    const offset = limit * (+pageNumber - 1);

    const { count, rows: contacts } = await Contact.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      order: [["name", "ASC"]]
    });

    return { contacts, count, limit, offset };
  }

  /** Listagem simples de GET /contacts/list (query original preservada). */
  public async findAllSimple(
    filters: SimpleListContactsFilters
  ): Promise<Contact[]> {
    const { name, companyId } = filters;

    let options: FindOptions = {
      order: [
        ['name', 'ASC']
      ]
    }

    if (name) {
      options.where = {
        name: {
          [Op.like]: `%${name}%`
        }
      }
    }

    options.where = {
      ...options.where,
      companyId
    }

    return Contact.findAll(options);
  }

  // TODO(B2-users): o domínio users já migrou, mas o UsersRepository não tem
  // busca por email COM escopo de empresa — mover esta query para lá quando
  // ganhar um método equivalente (consulta idêntica à original preservada).
  public async findUserByCompanyAndEmail(
    companyId: number,
    email: string
  ): Promise<User | null> {
    return User.findOne({
      where: {
        companyId,
        email
      }
    });
  }
}
