/**
 * Contrato único de EVENTOS de socket (doc 04 §7).
 *
 * Inventário completo dos nomes emitidos hoje pelo backend (grep `.emit(` na
 * fase B0). CRÍTICO: os nomes ficam EXATAMENTE como são — incluindo os
 * inconsistentes, marcados com `TODO(par-frontend)`. A normalização é sempre
 * uma mudança pareada backend+frontend (lista fechada da fase F0.2), feita na
 * migração do módulo dono do evento, nunca aqui.
 */
export const SocketEvents = {
  // ── Eventos por empresa (templated) ────────────────────────────────────────
  companyTicket: (companyId: number): string => `company-${companyId}-ticket`,

  companyAppMessage: (companyId: number): string =>
    `company-${companyId}-appMessage`,

  companyContact: (companyId: number): string => `company-${companyId}-contact`,

  companyWhatsapp: (companyId: number): string =>
    `company-${companyId}-whatsapp`,

  companyWhatsappSession: (companyId: number): string =>
    `company-${companyId}-whatsappSession`,

  companyCampaign: (companyId: number): string =>
    `company-${companyId}-campaign`,

  companyCampaignSettings: (companyId: number): string =>
    `company-${companyId}-campaignSettings`,

  companyAnnouncement: (companyId: number): string =>
    `company-${companyId}-announcement`,

  companyChat: (companyId: number): string => `company-${companyId}-chat`,

  companyChatRoom: (companyId: number, chatId: number | string): string =>
    `company-${companyId}-chat-${chatId}`,

  companyChatUser: (companyId: number, userId: number | string): string =>
    `company-${companyId}-chat-user-${userId}`,

  companyQueue: (companyId: number): string => `company-${companyId}-queue`,

  companyFile: (companyId: number): string => `company-${companyId}-file`,

  companyHelp: (companyId: number): string => `company-${companyId}-help`,

  // Normalizado na B2 (par frontend: pages/QuickMessages) — o listener antigo
  // usava "company${id}-quickemessage" (sem hífen + typo "quickemessage"); os
  // dois lados agora usam este nome canônico.
  companyQuickMessage: (companyId: number): string =>
    `company-${companyId}-quickmessage`,

  companyQueueIntegration: (companyId: number): string =>
    `company-${companyId}-queueIntegration`,

  // Normalizado na B3 (par frontend: pages/ContactLists) — era o PascalCase
  // "-ContactList", fora do padrão dos demais sufixos (contact, campaign…).
  // Agora camelCase, como campaignSettings/queueIntegration.
  companyContactList: (companyId: number): string =>
    `company-${companyId}-contactList`,

  // Normalizado na B3 (par frontend: pages/ContactListItems) — era o PascalCase
  // "-ContactListItem".
  companyContactListItem: (companyId: number): string =>
    `company-${companyId}-contactListItem`,

  // Normalizado na B3 (par frontend: pages/ContactListItems). A variante com o
  // id da lista embutido no NOME do evento foi mantida na forma (o id ainda vem
  // no nome, não em sala/payload — refactor maior fora do escopo desta wave),
  // só o PascalCase virou camelCase.
  companyContactListItemScoped: (
    companyId: number,
    contactListId: number | string
  ): string => `company-${companyId}-contactListItem-${contactListId}`,

  companyUser: (companyId: number): string => `company-${companyId}-user`,

  companyAuth: (companyId: number): string => `company-${companyId}-auth`,

  companySettings: (companyId: number): string =>
    `company-${companyId}-settings`,

  /** Normalizado na B1 (par frontend: pages/Tags) — era o estático "tag". */
  companyTag: (companyId: number): string => `company-${companyId}-tag`,

  /**
   * Normalizado na B2 (par frontend: pages/Schedules) — era o estático
   * "schedule", que nunca casava com o listener `company${id}-schedule` (sem
   * hífen) do frontend. Realtime de schedules estava morto; este nome religa.
   */
  companySchedule: (companyId: number): string =>
    `company-${companyId}-schedule`,

  // ── Eventos estáticos (sem escopo de empresa no NOME) ─────────────────────
  // TODO(par-frontend): "ticket" estático emitido por CreateTicketService —
  // inconsistente com o templated companyTicket usado em todo o resto.
  ticket: "ticket",

  /** Handshake: emitido ao cliente quando a conexão termina o setup. */
  ready: "ready"
};

/**
 * Eventos recebidos DO cliente (socket.on em libs/socket.ts) — espelho para o
 * contrato compartilhado com o frontend (fase F0).
 */
export const ClientSocketEvents = {
  joinChatBox: "joinChatBox",
  leaveChatBox: "leaveChatBox",
  joinNotification: "joinNotification",
  leaveNotification: "leaveNotification",
  joinTickets: "joinTickets",
  leaveTickets: "leaveTickets"
};
