import Announcement from "../models/Announcement";

/**
 * Entrada de `AnnouncementsService.list` (listagem paginada da tela de
 * Announcements). A listagem é global por status (comportamento original do
 * ListService: filtra `status: true`, sem escopo de empresa).
 */
export interface ListAnnouncementsFilters {
  searchParam?: string;
  /** Vem da query string; default "1" (comportamento original). */
  pageNumber?: string;
}

/** Saída de `AnnouncementsService.list`. */
export interface ListAnnouncementsResult {
  records: Announcement[];
  count: number;
  hasMore: boolean;
}
