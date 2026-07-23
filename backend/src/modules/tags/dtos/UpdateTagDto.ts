/** Entrada de `TagsService.update` (doc 04 §4). Campos ausentes não mudam. */
export interface UpdateTagDto {
  name?: string;
  color?: string;
  kanban?: number;
}
