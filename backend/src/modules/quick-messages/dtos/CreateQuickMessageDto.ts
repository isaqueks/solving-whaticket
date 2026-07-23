/** Entrada de `QuickMessagesService.create` (doc 04 §4). */
export interface CreateQuickMessageDto {
  shortcode: string;
  message: string;
  companyId: number;
  /** `req.user.id` chega como string; o model aceita a coerção. */
  userId: number | string;
}
