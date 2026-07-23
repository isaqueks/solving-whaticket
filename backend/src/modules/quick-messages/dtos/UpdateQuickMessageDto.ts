/** Entrada de `QuickMessagesService.update` (doc 04 §4). */
export interface UpdateQuickMessageDto {
  shortcode: string;
  message: string;
  userId: number | string;
}
