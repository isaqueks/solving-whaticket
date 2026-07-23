import { Op } from "sequelize";

import { ChatParticipantInput } from "./dtos/ChatParticipantInput";
import { CreateChatDto } from "./dtos/CreateChatDto";
import Chat from "./models/Chat";
import ChatMessage from "./models/ChatMessage";
import ChatUser from "./models/ChatUser";
import User from "../users/models/User";

export interface PagedResult<T> {
  records: T[];
  count: number;
}

/**
 * Único ponto de acesso aos models do agregado Chat (doc 04 §3): Chat,
 * ChatMessage e ChatUser. Um chat não existe sem seus participantes e suas
 * mensagens — os três models formam UM agregado, então vivem num único
 * repository (mesmo critério do TagsRepository, que possui Tag + TicketTag).
 * Não emite socket nem lança erro de negócio — retorna dados/null e o service
 * decide.
 */
export class ChatsRepository {
  // ── Leituras do agregado ───────────────────────────────────────────────────

  /** Chats em que o usuário participa, paginados (tela de Chat interno). */
  public async findPagedByParticipant(
    ownerId: number,
    limit: number,
    offset: number
  ): Promise<PagedResult<Chat>> {
    const chatUsers = await ChatUser.findAll({ where: { userId: ownerId } });
    const chatIds = chatUsers.map(chatUser => chatUser.chatId);

    const { count, rows: records } = await Chat.findAndCountAll({
      where: { id: { [Op.in]: chatIds } },
      include: this.detailedInclude(),
      limit,
      offset,
      order: [["createdAt", "DESC"]]
    });

    return { records, count };
  }

  public async findByUuid(uuid: string): Promise<Chat | null> {
    return Chat.findOne({ where: { uuid } });
  }

  public async findById(id: string | number): Promise<Chat | null> {
    return Chat.findOne({ where: { id } });
  }

  /** Chat com dono e participantes (payload dos eventos de mensagem/leitura). */
  public async findByIdWithOwnerAndUsers(
    id: string | number
  ): Promise<Chat | null> {
    return Chat.findByPk(id, {
      include: [
        { model: User, as: "owner" },
        { model: ChatUser, as: "users" }
      ]
    });
  }

  // ── Escritas do agregado ────────────────────────────────────────────────────

  public async create(dto: CreateChatDto): Promise<Chat> {
    const { ownerId, companyId, users, title } = dto;

    const record = await Chat.create({ ownerId, companyId, title });

    if (Array.isArray(users) && users.length > 0) {
      await ChatUser.create({ chatId: record.id, userId: ownerId });
      for (const user of users) {
        await ChatUser.create({ chatId: record.id, userId: user.id });
      }
    }

    await record.reload({ include: this.detailedInclude() });

    return record;
  }

  /**
   * Atualiza título e — se `users` vier — substitui o conjunto de participantes
   * (destroy + recria dono e demais, sem duplicar o dono). Retorna o chat
   * recarregado com dono e participantes.
   */
  public async update(
    id: number,
    title: string | undefined,
    users?: ChatParticipantInput[]
  ): Promise<Chat> {
    const record = await Chat.findByPk(id, {
      include: [{ model: ChatUser, as: "users" }]
    });
    const { ownerId } = record;

    await record.update({ title });

    if (Array.isArray(users)) {
      await ChatUser.destroy({ where: { chatId: record.id } });
      await ChatUser.create({ chatId: record.id, userId: ownerId });
      for (const user of users) {
        if (user.id !== ownerId) {
          await ChatUser.create({ chatId: record.id, userId: user.id });
        }
      }
    }

    await record.reload({ include: this.detailedInclude() });

    return record;
  }

  public async destroy(chat: Chat): Promise<void> {
    await chat.destroy();
  }

  // ── Mensagens e não-lidos ───────────────────────────────────────────────────

  /** Quantas linhas de participação o usuário tem no chat (guard de acesso). */
  public async countParticipant(
    chatId: string,
    userId: number
  ): Promise<number> {
    return ChatUser.count({ where: { chatId, userId } });
  }

  public async findPagedMessages(
    chatId: string,
    limit: number,
    offset: number
  ): Promise<PagedResult<ChatMessage>> {
    const { count, rows: records } = await ChatMessage.findAndCountAll({
      where: { chatId },
      include: [{ model: User, as: "sender", attributes: ["id", "name"] }],
      limit,
      offset,
      order: [["createdAt", "DESC"]]
    });

    return { records, count };
  }

  public async createMessage(
    chatId: number,
    senderId: number,
    message: string
  ): Promise<ChatMessage> {
    const newMessage = await ChatMessage.create({ chatId, senderId, message });

    await newMessage.reload({
      include: [
        { model: User, as: "sender", attributes: ["id", "name"] },
        {
          model: Chat,
          as: "chat",
          include: [{ model: ChatUser, as: "users" }]
        }
      ]
    });

    return newMessage;
  }

  public async findChatUsers(chatId: number): Promise<ChatUser[]> {
    return ChatUser.findAll({ where: { chatId } });
  }

  public async findChatUser(
    chatId: string,
    userId: number
  ): Promise<ChatUser | null> {
    return ChatUser.findOne({ where: { chatId, userId } });
  }

  public async setUnreads(chatUser: ChatUser, unreads: number): Promise<void> {
    await chatUser.update({ unreads });
  }

  /**
   * Include padrão do agregado: participantes (cada um com seu usuário) e dono.
   * Retorna um array novo a cada chamada — evita compartilhar a config de
   * include entre queries (doc 04 §10, sem duplicar o literal por método).
   */
  private detailedInclude(): object[] {
    return [
      { model: ChatUser, as: "users", include: [{ model: User, as: "user" }] },
      { model: User, as: "owner" }
    ];
  }
}
