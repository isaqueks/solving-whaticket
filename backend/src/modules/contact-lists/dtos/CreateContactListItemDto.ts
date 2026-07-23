/**
 * Entrada de criação de item de lista. Também é o shape usado na importação
 * XLSX (uma linha da planilha vira um DTO destes).
 */
export interface CreateContactListItemDto {
  name: string;
  number: string;
  contactListId: number;
  companyId: number;
  email?: string;
}
