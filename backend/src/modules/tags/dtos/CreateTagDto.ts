/**
 * Entrada de `TagsService.create` (doc 04 §4).
 * `color`/`kanban` são opcionais — o service aplica os defaults do domínio
 * ("#A4CCCC" e 0, comportamento original do CreateService).
 */
export interface CreateTagDto {
  name: string;
  color?: string;
  kanban?: number;
  companyId: number;
}
