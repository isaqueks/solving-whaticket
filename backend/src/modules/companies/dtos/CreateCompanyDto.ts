/**
 * Entrada de `CompaniesService.create` (doc 04 §4). Espelha o body aceito pelo
 * antigo `CreateCompanyService` — `name` obrigatório, o resto opcional.
 *
 * `password` é usado só na criação do usuário admin da empresa (default aleatório
 * quando ausente); `campaignsEnabled` grava uma Setting, não uma coluna de Company.
 */
export interface CreateCompanyDto {
  name: string;
  phone?: string;
  email?: string;
  password?: string;
  status?: boolean;
  planId?: number;
  campaignsEnabled?: boolean;
  dueDate?: string;
  recurrence?: string;
}
