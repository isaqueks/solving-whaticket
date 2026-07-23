/**
 * Contrato único de SALAS de socket (doc 04 §7).
 *
 * As 5 famílias de sala hoje existentes (auditoria B0.2), mais as salas de
 * usuário e de ticket. Os nomes são EXATAMENTE os atuais — qualquer
 * normalização é mudança pareada com o frontend (fase F0.2), nunca aqui.
 */
export const Rooms = {
  /** Canal principal da empresa; todo cliente conectado entra nela. */
  mainChannel: (companyId: number): string => `company-${companyId}-mainchannel`,

  /** Sala por status de ticket no escopo da empresa (open/pending/closed…). */
  companyStatus: (companyId: number, status: string): string =>
    `company-${companyId}-${status}`,

  /** Notificações da empresa (admins). */
  companyNotification: (companyId: number): string =>
    `company-${companyId}-notification`,

  /**
   * Sala por status no escopo da fila. `queueId` pode ser null — a sala
   * "queue-null-<status>" é real e usada por usuários com allTicket=enabled.
   */
  queueStatus: (queueId: number | null, status: string): string =>
    `queue-${queueId}-${status}`,

  /** Notificações da fila (mesma observação sobre queue-null). */
  queueNotification: (queueId: number | null): string =>
    `queue-${queueId}-notification`,

  /** Sala individual do usuário. */
  user: (userId: number): string => `user-${userId}`,

  /** Sala do ticket — o nome da sala é o próprio id, sem prefixo. */
  ticket: (ticketId: number | string): string => String(ticketId),

  /**
   * Sala legada "open" (sem escopo de empresa) usada pelas emissões históricas
   * dos jobs de vínculo/fechamento automático de tickets. Ninguém entra nela
   * hoje (o frontend usa `company-X-open`), mas o nome fica preservado até a
   * limpeza pareada com o frontend (fase F0).
   */
  legacyOpen: "open"
};
