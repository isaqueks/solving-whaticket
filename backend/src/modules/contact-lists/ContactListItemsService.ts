import AppError from "../../shared/errors/AppError";
import { SocketEvents } from "../../shared/realtime/events";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";
import { ContactListItemNumberValidator } from "./ContactListItemNumberValidator";
import { ContactListItemsRepository } from "./ContactListItemsRepository";
import { CreateContactListItemDto } from "./dtos/CreateContactListItemDto";
import { FindContactListItemsFilters } from "./dtos/FindContactListItemsFilters";
import {
  ListContactListItemsFilters,
  ListContactListItemsResult
} from "./dtos/ListContactListItemsFilters";
import { UpdateContactListItemDto } from "./dtos/UpdateContactListItemDto";
import ContactListItem from "./models/ContactListItem";

/** Tamanho de página fixo (comportamento original do ListService). */
const LIST_PAGE_SIZE = 20;

/**
 * Casos de uso do domínio ContactListItems (doc 04 §§2–3). Absorve os 6
 * arquivos usados do antigo `services/ContactListItemService/`; o
 * `FindAllService` legado era código morto e não foi trazido. A conferência do
 * número contra o WhatsApp fica no `ContactListItemNumberValidator`
 * compartilhado (mesmo bloco antes duplicado em Create/Update/Import).
 */
export class ContactListItemsService {
  constructor(
    private readonly repository = new ContactListItemsRepository(),
    private readonly numberValidator = new ContactListItemNumberValidator(),
    private readonly realtime: RealtimeGateway = realtimeGateway
  ) {}

  public async list(
    filters: ListContactListItemsFilters
  ): Promise<ListContactListItemsResult> {
    const { companyId, contactListId, searchParam, pageNumber = "1" } = filters;
    const limit = LIST_PAGE_SIZE;
    const offset = limit * (+pageNumber - 1);

    const { contacts, count } =
      await this.repository.findAndCountByListAndSearch({
        companyId,
        contactListId,
        searchParam,
        limit,
        offset
      });

    const hasMore = count > offset + contacts.length;

    return { contacts, count, hasMore };
  }

  public async create(
    dto: CreateContactListItemDto
  ): Promise<ContactListItem> {
    const [record] = await this.repository.findOrCreate(dto);

    await this.numberValidator.validateAndPersist(record);

    this.emitItemEvent(dto.companyId, { action: "create", record });

    return record;
  }

  public async show(id: string | number): Promise<ContactListItem> {
    return this.findByIdOrFail(id);
  }

  public async update(
    id: string | number,
    dto: UpdateContactListItemDto,
    companyId: number
  ): Promise<ContactListItem> {
    const record = await this.findByIdOrFail(id);

    const updated = await this.repository.update(record, {
      name: dto.name,
      number: dto.number,
      email: dto.email
    });

    await this.numberValidator.validateAndPersist(updated);

    this.emitItemEvent(companyId, { action: "update", record: updated });

    return updated;
  }

  public async delete(id: string | number, companyId: number): Promise<void> {
    const record = await this.findByIdOrFail(id);

    await this.repository.delete(record);

    // Payload `{ action: "delete", id }` preservado do controller legado.
    this.emitItemEvent(companyId, { action: "delete", id });
  }

  public async findByCompanyAndList(
    filters: FindContactListItemsFilters
  ): Promise<ContactListItem[]> {
    return this.repository.findAllByCompanyAndList(filters);
  }

  private async findByIdOrFail(id: string | number): Promise<ContactListItem> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new AppError("ERR_NO_CONTACTLISTITEM_FOUND", 404);
    }

    return record;
  }

  private emitItemEvent(companyId: number, payload: unknown): void {
    this.realtime.emitToMainChannel(
      companyId,
      SocketEvents.companyContactListItem(companyId),
      payload
    );
  }
}
