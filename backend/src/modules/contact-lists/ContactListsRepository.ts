import { Op, fn, col, where, WhereOptions } from "sequelize";

// TODO(B3/Companies-Plans): Company pertence ao domínio Companies (migra em
// paralelo nesta wave). Import por caminho, comportamento intocado — o include
// só traz id/name para a busca simples.
import Company from "../companies/models/Company";
import { CreateContactListDto } from "./dtos/CreateContactListDto";
import ContactList from "./models/ContactList";
import ContactListItem from "./models/ContactListItem";

/** Parâmetros da listagem paginada (contagem de itens por lista). */
export interface PagedContactListsQuery {
  companyId: number | string;
  searchParam?: string;
  limit: number;
  offset: number;
}

export interface PagedContactListsResult {
  records: ContactList[];
  count: number;
}

/**
 * Único ponto de acesso ao model ContactList (doc 04 §3). Não emite socket nem
 * lança erro de negócio — retorna dados/null e o service decide.
 */
export class ContactListsRepository {
  /**
   * Listagem paginada com a contagem de itens (`contactsCount`) por lista.
   * Preserva a query do ListService legado: LOWER/LIKE no nome, agrupamento por
   * `ContactList.id` e `count(contacts.id)` como atributo virtual.
   */
  public async findAndCountWithContactsCount(
    query: PagedContactListsQuery
  ): Promise<PagedContactListsResult> {
    const { companyId, searchParam, limit, offset } = query;

    const { count, rows: records } = await ContactList.findAndCountAll({
      where: this.buildListWhere(companyId, searchParam),
      limit,
      offset,
      order: [["name", "ASC"]],
      subQuery: false,
      include: [
        {
          model: ContactListItem,
          as: "contacts",
          attributes: [],
          required: false
        }
      ],
      attributes: [
        "id",
        "name",
        [fn("count", col("contacts.id")), "contactsCount"]
      ],
      group: ["ContactList.id"]
    });

    // count/hasMore tratados como no ListService legado (e no TagsRepository):
    // Sequelize tipa `count` como number, então o service compara direto.
    return { records, count };
  }

  public async findById(id: string | number): Promise<ContactList | null> {
    return ContactList.findByPk(id);
  }

  /** Busca simples por empresa, com a empresa embutida (id/name). */
  public async findAllByCompany(
    companyId: number | string
  ): Promise<ContactList[]> {
    return ContactList.findAll({
      where: { companyId },
      include: [{ model: Company, as: "company", attributes: ["id", "name"] }],
      order: [["name", "ASC"]]
    });
  }

  public async create(dto: CreateContactListDto): Promise<ContactList> {
    return ContactList.create(dto);
  }

  public async update(
    record: ContactList,
    attributes: { name: string }
  ): Promise<ContactList> {
    await record.update(attributes);

    return record;
  }

  public async delete(record: ContactList): Promise<void> {
    await record.destroy();
  }

  private buildListWhere(
    companyId: number | string,
    searchParam?: string
  ): WhereOptions {
    // Sem busca: só o escopo de empresa (isEmpty do ListService legado).
    if (!searchParam) {
      return { companyId };
    }

    return {
      companyId,
      [Op.or]: [
        {
          name: where(
            fn("LOWER", col("ContactList.name")),
            "LIKE",
            `%${searchParam.toLowerCase().trim()}%`
          )
        }
      ]
    };
  }
}
