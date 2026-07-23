import { ContactExtraInfoDto } from "./ContactExtraInfoDto";

/**
 * Corpo aceito por PUT /contacts/:contactId (antigo `ContactData` do
 * controller + UpdateContactService).
 */
export interface UpdateContactDto {
  name?: string;
  number?: string;
  email?: string;
  extraInfo?: ContactExtraInfoDto[];
}
