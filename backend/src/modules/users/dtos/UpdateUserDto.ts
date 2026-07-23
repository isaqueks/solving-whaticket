/**
 * Entrada de `UsersService.update` (doc 04 §4) — espelha o `UserData` do antigo
 * UpdateUserService. Todos os campos são opcionais (atualização parcial).
 */
export interface UpdateUserDto {
  email?: string;
  password?: string;
  name?: string;
  profile?: string;
  companyId?: number;
  queueIds?: number[];
  whatsappId?: number;
  allTicket?: string;
}
