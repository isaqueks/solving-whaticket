/**
 * Entrada de `UsersService.create` (doc 04 §4).
 * `profile` é opcional — o service aplica o default do domínio ("admin",
 * comportamento original do CreateUserService).
 */
export interface CreateUserDto {
  email: string;
  password: string;
  name: string;
  queueIds?: number[];
  companyId?: number | null;
  profile?: string;
  whatsappId?: number;
  allTicket?: string;
}
