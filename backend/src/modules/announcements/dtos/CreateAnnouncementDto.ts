/**
 * Entrada de `AnnouncementsService.create` (doc 04 §4).
 * `priority`/`status` são opcionais — o model aceita ausência (colunas
 * nulláveis), comportamento original do CreateService.
 */
export interface CreateAnnouncementDto {
  priority?: number;
  title: string;
  text: string;
  status?: boolean;
  companyId: number;
}
