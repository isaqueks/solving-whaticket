/**
 * Entrada de `ForgotPasswordService.sendResetEmail` (doc 04 §4).
 * O token de redefinição é gerado internamente pelo service (uuid), então
 * o único dado de entrada é o e-mail do usuário.
 */
export interface SendResetEmailDto {
  email: string;
}
