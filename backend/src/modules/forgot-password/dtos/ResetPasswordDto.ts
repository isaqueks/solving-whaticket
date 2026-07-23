/**
 * Entrada de `ForgotPasswordService.resetPassword` (doc 04 §4).
 * `token` é o código enviado por e-mail (armazenado em `Users.resetPassword`).
 */
export interface ResetPasswordDto {
  email: string;
  token: string;
  password: string;
}
