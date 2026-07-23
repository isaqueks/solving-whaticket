/**
 * Espelho FRONTEND do contrato de eventos de socket (doc 04 §7).
 *
 * Fonte da verdade: backend/src/shared/realtime/events.ts (fase B0). Este
 * arquivo é o outro lado do mesmo contrato — um lugar único de onde o frontend
 * lê os nomes de evento, em vez de montar `company-${id}-...` na mão espalhado
 * por 28 arquivos.
 *
 * REGRA: os nomes ficam EXATAMENTE como estão no backend hoje, incluindo os
 * inconsistentes (backend os marca com TODO(par-frontend)). Qualquer
 * normalização é mudança pareada backend+frontend, feita na migração do módulo
 * dono do evento — nunca aqui. Este arquivo é só o contrato; a migração dos
 * `socket.on(...)` inline para cá é a fase F1.
 *
 * EXCEÇÃO: `companyTag` já usa o nome canônico templated `company-${id}-tag`
 * (o backend ainda tem o `tag` estático, sendo normalizado pela fase B1 em par
 * com o frontend). Este é o nome pós-B1.
 */
export const SocketEvents = {
  // ── Eventos por empresa (templated) ────────────────────────────────────────
  companyTicket: (companyId) => `company-${companyId}-ticket`,

  companyAppMessage: (companyId) => `company-${companyId}-appMessage`,

  companyContact: (companyId) => `company-${companyId}-contact`,

  companyWhatsapp: (companyId) => `company-${companyId}-whatsapp`,

  companyWhatsappSession: (companyId) => `company-${companyId}-whatsappSession`,

  companyCampaign: (companyId) => `company-${companyId}-campaign`,

  // Sem listener no frontend hoje; mantido porque o backend emite o evento.
  companyCampaignSettings: (companyId) =>
    `company-${companyId}-campaignSettings`,

  companyAnnouncement: (companyId) => `company-${companyId}-announcement`,

  companyChat: (companyId) => `company-${companyId}-chat`,

  companyChatRoom: (companyId, chatId) => `company-${companyId}-chat-${chatId}`,

  companyChatUser: (companyId, userId) =>
    `company-${companyId}-chat-user-${userId}`,

  companyQueue: (companyId) => `company-${companyId}-queue`,

  companyFile: (companyId) => `company-${companyId}-file`,

  // Sem listener no frontend hoje; mantido porque o backend emite o evento.
  companyHelp: (companyId) => `company-${companyId}-help`,

  // Normalizado na B2 (par backend: modules/quick-messages) — o listener antigo
  // em pages/QuickMessages usava "company${id}-quickemessage" (sem hífen +
  // typo). Ambos os lados agora usam este nome canônico.
  companyQuickMessage: (companyId) => `company-${companyId}-quickmessage`,

  companyQueueIntegration: (companyId) =>
    `company-${companyId}-queueIntegration`,

  // Normalizado na B3 (par backend: modules/contact-lists) — era o PascalCase
  // "-ContactList". Ambos os lados agora usam este nome canônico camelCase.
  companyContactList: (companyId) => `company-${companyId}-contactList`,

  // Normalizado na B3 (par backend: modules/contact-lists) — era o PascalCase
  // "-ContactListItem".
  companyContactListItem: (companyId) => `company-${companyId}-contactListItem`,

  // Normalizado na B3 (par backend: modules/contact-lists). Só o PascalCase
  // virou camelCase; o id da lista segue embutido no nome do evento.
  companyContactListItemScoped: (companyId, contactListId) =>
    `company-${companyId}-contactListItem-${contactListId}`,

  companyUser: (companyId) => `company-${companyId}-user`,

  companyAuth: (companyId) => `company-${companyId}-auth`,

  // Sem listener no frontend hoje; mantido porque o backend emite o evento.
  companySettings: (companyId) => `company-${companyId}-settings`,

  // EXCEÇÃO (pós-B1): nome canônico templated. O backend está normalizando o
  // `tag` estático em par com o frontend nesta rodada.
  companyTag: (companyId) => `company-${companyId}-tag`,

  // EXCEÇÃO (pós-B2): nome canônico templated. Era o estático "schedule" no
  // backend + listener `company${id}-schedule` (sem hífen) no frontend — nunca
  // casavam. Normalizado em par nesta rodada; realtime de schedules religado.
  companySchedule: (companyId) => `company-${companyId}-schedule`,

  // ── Eventos estáticos (sem escopo de empresa no NOME) ──────────────────────
  // TODO(par): "ticket" estático emitido por CreateTicketService — inconsistente
  // com o templated companyTicket usado no resto.
  ticket: "ticket",

  /** Handshake: emitido ao cliente quando a conexão termina o setup. */
  ready: "ready"
};

/**
 * Eventos que o CLIENTE emite para o servidor (espelho de
 * backend/src/shared/realtime/events.ts → ClientSocketEvents).
 */
export const ClientSocketEvents = {
  joinChatBox: "joinChatBox",
  leaveChatBox: "leaveChatBox",
  joinNotification: "joinNotification",
  leaveNotification: "leaveNotification",
  joinTickets: "joinTickets",
  leaveTickets: "leaveTickets"
};
