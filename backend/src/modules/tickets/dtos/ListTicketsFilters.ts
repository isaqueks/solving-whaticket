import Ticket from "../models/Ticket";

/**
 * Filtros da listagem principal de tickets (antigo ListTicketsService).
 * A variante kanban usa os mesmos campos EXCETO `unread` e `status`
 * (o kanban ignora `status` e força pending/open) — ver ListTicketsKanbanFilters.
 */
export interface ListTicketsFilters {
  searchParam?: string;
  pageNumber?: string;
  status?: string;
  date?: string;
  updatedAt?: string;
  showAll?: string;
  userId: string;
  withUnreadMessages?: string;
  queueIds: number[];
  tags: number[];
  users: number[];
  companyId: number;
  unread?: "unread" | "read";
}

/** Filtros do kanban (antigo ListTicketsServiceKanban). */
export type ListTicketsKanbanFilters = Omit<ListTicketsFilters, "unread">;

export interface ListTicketsResult {
  tickets: Ticket[];
  count: number;
  hasMore: boolean;
}
