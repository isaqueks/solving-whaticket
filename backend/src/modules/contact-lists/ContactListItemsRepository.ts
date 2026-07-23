import { Op, Sequelize, WhereOptions } from "sequelize";

// TODO(B3/Companies-Plans): Company pertence ao domínio Companies (migra em
// paralelo nesta wave). Import por caminho, comportamento intocado — o include
// só traz id/name para a busca simples.
import Company from "../companies/models/Company";
import { CreateContactListItemDto } from "./dtos/CreateContactListItemDto";
import { FindContactListItemsFilters } from "./dtos/FindContactListItemsFilters";
import ContactListItem from "./models/ContactListItem";

/** Atributos editáveis de um item de lista. */
export interface ContactListItemAttributes {
  name: string;
  number: string;
  email?: string;
}

/** Parâmetros da listagem paginada de itens. */
export interface PagedContactListItemsQuery {
  companyId: number | string;
  contactListId: number | string;
  searchParam?: string;
  limit: number;
  offset: number;
}

export interface PagedContactListItemsResult {
  contacts: ContactListItem[];
  count: number;
}

/**
 * Único ponto de acesso ao model ContactListItem (doc 04 §3). Não emite socket
 * nem lança erro de negócio — retorna dados/null e o service decide.
 */
export class ContactListItemsRepository {
  /**
   * Listagem paginada por lista + busca (LOWER/LIKE no nome, LIKE no número).
   * Preserva a query do ListService legado.
   */
  public async findAndCountByListAndSearch(
    query: PagedContactListItemsQuery
  ): Promise<PagedContactListItemsResult> {
    const { companyId, contactListId, searchParam = "", limit, offset } = query;

    const { count, rows: contacts } = await ContactListItem.findAndCountAll({
      where: this.buildListWhere(companyId, contactListId, searchParam),
      limit,
      offset,
      order: [["name", "ASC"]]
    });

    return { contacts, count };
  }

  public async findById(id: string | number): Promise<ContactListItem | null> {
    return ContactListItem.findByPk(id);
  }

  /**
   * Projeção enxuta usada pelos jobs de disparo de campanha (B6) — só os
   * campos consumidos na renderização da mensagem, como no antigo getContact.
   */
  public async findByIdForDispatch(
    id: number
  ): Promise<ContactListItem | null> {
    return ContactListItem.findByPk(id, {
      attributes: ["id", "name", "number", "email"]
    });
  }

  /** Total de itens válidos no WhatsApp da lista (finalização de campanha, B6). */
  public async countValidWhatsappByList(
    contactListId: number
  ): Promise<number> {
    return ContactListItem.count({
      where: {
        contactListId,
        isWhatsappValid: true
      }
    });
  }

  /** Criação em lote (fluxo campanha-por-tag, B6). */
  public async bulkCreate(
    items: Array<{
      name: string;
      number: string;
      email: string;
      contactListId: number;
      companyId: number;
      isWhatsappValid: boolean;
    }>
  ): Promise<ContactListItem[]> {
    // Typings do Sequelize v5 não modelam atributos de criação — cast
    // confinado ao repository (doc 04 §4).
    return ContactListItem.bulkCreate(items as Array<Partial<ContactListItem>>);
  }

  /**
   * findOrCreate por (número, empresa, lista) — usado tanto na criação avulsa
   * quanto na importação XLSX. Retorna `[item, created]` como o legado, para o
   * chamador decidir se enfileira a validação de número.
   */
  public async findOrCreate(
    dto: CreateContactListItemDto
  ): Promise<[ContactListItem, boolean]> {
    return ContactListItem.findOrCreate({
      where: {
        number: `${dto.number}`,
        companyId: dto.companyId,
        contactListId: dto.contactListId
      },
      defaults: dto
    });
  }

  public async update(
    item: ContactListItem,
    attributes: ContactListItemAttributes
  ): Promise<ContactListItem> {
    await item.update(attributes);

    return item;
  }

  public async delete(item: ContactListItem): Promise<void> {
    await item.destroy();
  }

  /** Busca simples por empresa (e lista, quando informada), com a empresa. */
  public async findAllByCompanyAndList(
    filters: FindContactListItemsFilters
  ): Promise<ContactListItem[]> {
    const { companyId, contactListId } = filters;
    const whereCondition: WhereOptions = { companyId };

    if (contactListId) {
      whereCondition.contactListId = contactListId;
    }

    return ContactListItem.findAll({
      where: whereCondition,
      include: [{ model: Company, as: "company", attributes: ["id", "name"] }],
      order: [["name", "ASC"]]
    });
  }

  private buildListWhere(
    companyId: number | string,
    contactListId: number | string,
    searchParam: string
  ): WhereOptions {
    const term = `%${searchParam.toLowerCase().trim()}%`;

    return {
      [Op.or]: [
        {
          name: Sequelize.where(
            Sequelize.fn("LOWER", Sequelize.col("name")),
            "LIKE",
            term
          )
        },
        { number: { [Op.like]: term } }
      ],
      companyId,
      contactListId
    };
  }
}
