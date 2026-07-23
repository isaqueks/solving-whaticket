import { SerializedUser } from "../../users/serializers/SerializeUser";

/** Credenciais recebidas em POST /auth/login. */
export interface LoginDto {
  email: string;
  password: string;
}

/**
 * Saída do caso de uso de login (forma original do antigo AuthUserService):
 * usuário serializado + par de tokens JWT legados, ainda devolvidos na
 * resposta de login por compatibilidade (a autenticação efetiva das
 * requisições é o cookie `user` validado no SSO — ver isAuth).
 */
export interface LoginResult {
  serializedUser: SerializedUser;
  token: string;
  refreshToken: string;
}
