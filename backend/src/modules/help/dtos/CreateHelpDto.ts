/**
 * Entrada de `HelpService.create` (doc 04 §4).
 * `description`/`video`/`link` são opcionais (comportamento original do
 * CreateService, que persistia apenas os campos presentes no body).
 */
export interface CreateHelpDto {
  title: string;
  description?: string;
  video?: string;
  link?: string;
}
