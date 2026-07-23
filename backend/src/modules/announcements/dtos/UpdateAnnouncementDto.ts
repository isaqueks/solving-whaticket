/**
 * Entrada de `AnnouncementsService.update` (doc 04 §4). Todos opcionais: o
 * service aplica só os campos presentes (o boundary garante `title`).
 */
export interface UpdateAnnouncementDto {
  priority?: number;
  title?: string;
  text?: string;
  status?: boolean;
}
