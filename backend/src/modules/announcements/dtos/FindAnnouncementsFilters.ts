/**
 * Entrada de `AnnouncementsService.find` (lista plana por empresa, com a
 * empresa embutida — endpoint `/announcements/list`).
 */
export interface FindAnnouncementsFilters {
  companyId: string;
}
