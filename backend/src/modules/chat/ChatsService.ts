import AppError from "../../shared/errors/AppError";
import { SocketEvents } from "../../shared/realtime/events";
import {
  RealtimeGateway,
  realtimeGateway
} from "../../shared/realtime/RealtimeGateway";
import { sortBy } from "lodash";

import { CreateChatDto } from "./dtos/CreateChatDto";
import { CreateChatMessageDto } from "./dtos/CreateChatMessageDto";
import {
  FindChatMessagesFilters,
  FindChatMessagesResult
} from "./dtos/FindChatMessagesFilters";
import { ListChatsFilters, ListChatsResult } from "./dtos/ListChatsFilters";
import { MarkChatAsReadDto } from "./dtos/MarkChatAsReadDto";
import { UpdateChatDto } from "./dtos/UpdateChatDto";
import Chat from "./models/Chat";
import ChatMessage from "./models/ChatMessage";
import ChatUser from "./models/ChatUser";
import { ChatsRepository } from "./ChatsRepository";

/** Tamanho de página das listagens de chats e de mensagens (comportamento original). */
const LIST_PAGE_SIZE = 20;

/**
 * Casos de uso do domínio Chat interno (doc 04 §§2–3). Absorve os services do
 * antigo `services/ChatService/` e os blocos de realtime que estavam no
 * controller. Regras de negócio preservadas; eventos de domínio emitidos via
 * RealtimeGateway (nunca `io.to` direto).
 */
export class ChatsService {
  constructor(
    private readonly repository = new ChatsRepository(),
    private readonly realtime: RealtimeGateway = realtimeGateway
  ) {}

  public async list(filters: ListChatsFilters): Promise<ListChatsResult> {
    const { ownerId, pageNumber = "1" } = filters;
    const offset = LIST_PAGE_SIZE * (+pageNumber - 1);

    const { records, count } = await this.repository.findPagedByParticipant(
      ownerId,
      LIST_PAGE_SIZE,
      offset
    );

    const hasMore = count > offset + records.length;

    return { records, count, hasMore };
  }

  public async showByUuid(uuid: string): Promise<Chat> {
    const record = await this.repository.findByUuid(uuid);
    if (!record) {
      throw new AppError("ERR_NO_CHAT_FOUND", 404);
    }

    return record;
  }

  public async create(dto: CreateChatDto): Promise<Chat> {
    const record = await this.repository.create(dto);

    this.emitToParticipants(dto.companyId, record, "create");

    return record;
  }

  public async update(dto: UpdateChatDto): Promise<Chat> {
    const { id, companyId, title, users } = dto;

    const record = await this.repository.update(id, title, users);

    this.emitToParticipants(companyId, record, "update");

    return record;
  }

  public async delete(id: string, companyId: number): Promise<void> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new AppError("ERR_NO_CHAT_FOUND", 404);
    }

    await this.repository.destroy(record);

    this.emitToCompany(companyId, { action: "delete", id });
  }

  public async findMessages(
    filters: FindChatMessagesFilters
  ): Promise<FindChatMessagesResult> {
    const { chatId, ownerId, pageNumber = "1" } = filters;

    const participation = await this.repository.countParticipant(
      chatId,
      ownerId
    );
    if (participation === 0) {
      throw new AppError("UNAUTHORIZED", 400);
    }

    const offset = LIST_PAGE_SIZE * (+pageNumber - 1);

    const { records, count } = await this.repository.findPagedMessages(
      chatId,
      LIST_PAGE_SIZE,
      offset
    );

    const hasMore = count > offset + records.length;

    return { records: sortBy(records, ["id", "ASC"]), count, hasMore };
  }

  /**
   * Cria a mensagem, atualiza os contadores de não-lidos (o remetente zera; os
   * demais participantes incrementam) e emite os eventos de nova mensagem para
   * a sala do chat e para o canal geral de chats da empresa.
   */
  public async createMessage(dto: CreateChatMessageDto): Promise<ChatMessage> {
    const { chatId, senderId, message, companyId } = dto;

    const newMessage = await this.repository.createMessage(
      chatId,
      senderId,
      message
    );

    await this.applyUnreads(chatId, senderId);

    const chat = await this.repository.findByIdWithOwnerAndUsers(chatId);

    const payload = { action: "new-message", newMessage, chat };
    this.emitToChatRoom(companyId, chatId, payload);
    this.emitToCompany(companyId, payload);

    return newMessage;
  }

  /** Zera os não-lidos do participante e notifica a atualização do chat. */
  public async markAsRead(dto: MarkChatAsReadDto): Promise<Chat> {
    const { chatId, userId, companyId } = dto;

    const chatUser = await this.repository.findChatUser(chatId, userId);
    if (!chatUser) {
      throw new AppError("ERR_NO_CHAT_FOUND", 404);
    }

    await this.repository.setUnreads(chatUser, 0);

    const chat = await this.repository.findByIdWithOwnerAndUsers(chatId);

    const payload = { action: "update", chat };
    this.emitToChatRoom(companyId, chatId, payload);
    this.emitToCompany(companyId, payload);

    return chat;
  }

  /** Regra de não-lidos: remetente volta a zero, demais incrementam em 1. */
  private async applyUnreads(chatId: number, senderId: number): Promise<void> {
    const chatUsers = await this.repository.findChatUsers(chatId);

    for (const chatUser of chatUsers) {
      const unreads =
        chatUser.userId === senderId ? 0 : chatUser.unreads + 1;
      await this.repository.setUnreads(chatUser, unreads);
    }
  }

  /** Evento por usuário: cada participante recebe na sua sala individual. */
  private emitToParticipants(
    companyId: number,
    record: Chat,
    action: "create" | "update"
  ): void {
    for (const chatUser of record.users) {
      this.realtime.emitToUser(
        chatUser.userId,
        SocketEvents.companyChatUser(companyId, chatUser.userId),
        { action, record }
      );
    }
  }

  private emitToChatRoom(
    companyId: number,
    chatId: number | string,
    payload: unknown
  ): void {
    this.realtime.emitToMainChannel(
      companyId,
      SocketEvents.companyChatRoom(companyId, chatId),
      payload
    );
  }

  private emitToCompany(companyId: number, payload: unknown): void {
    this.realtime.emitToMainChannel(
      companyId,
      SocketEvents.companyChat(companyId),
      payload
    );
  }
}
