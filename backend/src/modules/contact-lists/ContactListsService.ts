import { head, has } from "lodash";
import XLSX, { WorkSheet } from "xlsx";

import AppError from "../../shared/errors/AppError";
import { SocketEvents } from "../../shared/realtime/events";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";
import { ContactListItemNumberValidator } from "./ContactListItemNumberValidator";
import { ContactListItemsRepository } from "./ContactListItemsRepository";
import { ContactListsRepository } from "./ContactListsRepository";
import { CreateContactListDto } from "./dtos/CreateContactListDto";
import { CreateContactListItemDto } from "./dtos/CreateContactListItemDto";
import { FindContactListsFilters } from "./dtos/FindContactListsFilters";
import {
  ListContactListsFilters,
  ListContactListsResult
} from "./dtos/ListContactListsFilters";
import { UpdateContactListDto } from "./dtos/UpdateContactListDto";
import ContactList from "./models/ContactList";
import ContactListItem from "./models/ContactListItem";

/** Tamanho de página fixo (comportamento original do ListService). */
const LIST_PAGE_SIZE = 20;

/**
 * Casos de uso do domínio ContactLists (doc 04 §§2–3). Absorve os 7 arquivos
 * usados do antigo `services/ContactListService/` (incluindo a importação
 * XLSX); o `FindAllService` legado era código morto e não foi trazido.
 * Eventos de domínio via RealtimeGateway (nunca `io.to` direto).
 */
export class ContactListsService {
  constructor(
    private readonly repository = new ContactListsRepository(),
    private readonly itemsRepository = new ContactListItemsRepository(),
    private readonly numberValidator = new ContactListItemNumberValidator(),
    private readonly realtime: RealtimeGateway = realtimeGateway
  ) {}

  public async list(
    filters: ListContactListsFilters
  ): Promise<ListContactListsResult> {
    const { companyId, searchParam, pageNumber = "1" } = filters;
    const limit = LIST_PAGE_SIZE;
    const offset = limit * (+pageNumber - 1);

    const { records, count } =
      await this.repository.findAndCountWithContactsCount({
        companyId,
        searchParam,
        limit,
        offset
      });

    const hasMore = count > offset + records.length;

    return { records, count, hasMore };
  }

  public async create(dto: CreateContactListDto): Promise<ContactList> {
    const record = await this.repository.create(dto);

    this.emitListEvent(dto.companyId, { action: "create", record });

    return record;
  }

  public async show(id: string | number): Promise<ContactList> {
    return this.findByIdOrFail(id);
  }

  public async update(
    id: string | number,
    dto: UpdateContactListDto,
    companyId: number
  ): Promise<ContactList> {
    const record = await this.findByIdOrFail(id);

    const updated = await this.repository.update(record, { name: dto.name });

    this.emitListEvent(companyId, { action: "update", record: updated });

    return updated;
  }

  public async delete(id: string | number, companyId: number): Promise<void> {
    const record = await this.findByIdOrFail(id);

    await this.repository.delete(record);

    // Payload `{ action: "delete", id }` preservado do controller legado.
    this.emitListEvent(companyId, { action: "delete", id });
  }

  public async findByCompany(
    filters: FindContactListsFilters
  ): Promise<ContactList[]> {
    return this.repository.findAllByCompany(filters.companyId);
  }

  /**
   * Importa itens de uma planilha (rota POST /contact-lists/:id/upload).
   * Preserva a estrutura em dois laços do ImportContacts legado: primeiro
   * `findOrCreate` de todas as linhas, depois validação de número WhatsApp só
   * dos criados. Emite o `reload` com escopo da lista (evento dinâmico).
   */
  public async importContacts(
    contactListId: number,
    companyId: number,
    file: Express.Multer.File | undefined
  ): Promise<ContactListItem[]> {
    const rows = this.parseSpreadsheet(file, contactListId, companyId);

    const created: ContactListItem[] = [];
    for (const dto of rows) {
      const [item, wasCreated] = await this.itemsRepository.findOrCreate(dto);
      if (wasCreated) {
        created.push(item);
      }
    }

    for (const item of created) {
      await this.numberValidator.validateAndPersist(item);
    }

    this.realtime.emitToMainChannel(
      companyId,
      SocketEvents.companyContactListItemScoped(companyId, contactListId),
      { action: "reload", records: created }
    );

    return created;
  }

  private async findByIdOrFail(id: string | number): Promise<ContactList> {
    const record = await this.repository.findById(id);
    if (!record) {
      // Legado usava o código copy-paste `ERR_NO_TICKETNOTE_FOUND` só no
      // ShowService; unificado aqui no correto `ERR_NO_CONTACTLIST_FOUND` (o
      // mesmo que Update/Delete já usavam). Nenhum código tem tradução no
      // frontend, então a troca é invisível ao usuário.
      throw new AppError("ERR_NO_CONTACTLIST_FOUND", 404);
    }

    return record;
  }

  /** Lê a planilha e mapeia cada linha para um DTO de item (lógica original). */
  private parseSpreadsheet(
    file: Express.Multer.File | undefined,
    contactListId: number,
    companyId: number
  ): CreateContactListItemDto[] {
    const workbook = XLSX.readFile(file?.path as string);
    const worksheet = head(Object.values(workbook.Sheets)) as WorkSheet;
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, {
      header: 0
    });

    return rows.map(row => this.rowToItemDto(row, contactListId, companyId));
  }

  private rowToItemDto(
    row: Record<string, string>,
    contactListId: number,
    companyId: number
  ): CreateContactListItemDto {
    let name = "";
    let number = "";
    let email = "";

    if (has(row, "nome") || has(row, "Nome")) {
      name = row.nome || row.Nome;
    }

    if (
      has(row, "numero") ||
      has(row, "número") ||
      has(row, "Numero") ||
      has(row, "Número")
    ) {
      number = row.numero || row.número || row.Numero || row.Número;
      number = `${number}`.replace(/[^0-9|-]/g, "");
    }

    if (
      has(row, "email") ||
      has(row, "e-mail") ||
      has(row, "Email") ||
      has(row, "E-mail")
    ) {
      email = row.email || row["e-mail"] || row.Email || row["E-mail"];
    }

    return { name, number, email, contactListId, companyId };
  }

  private emitListEvent(companyId: number, payload: unknown): void {
    this.realtime.emitToMainChannel(
      companyId,
      SocketEvents.companyContactList(companyId),
      payload
    );
  }
}
