/**
 * Entrada de `HelpService.update` (doc 04 §4). Campos ausentes não mudam;
 * `title` continua obrigatório no boundary, como no controller original.
 */
export interface UpdateHelpDto {
  title: string;
  description?: string;
  video?: string;
  link?: string;
}
