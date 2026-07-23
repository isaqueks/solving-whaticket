import { ContactExtraInfoDto } from "./ContactExtraInfoDto";

/** Entrada de `ContactsService.create` (antigo CreateContactService). */
export interface CreateContactDto {
  name: string;
  number: string;
  email?: string;
  /** Aceito no contrato antigo, mas nunca persistido pelo create (preservado). */
  profilePicUrl?: string;
  taxId?: string;
  companyId: number;
  extraInfo?: ContactExtraInfoDto[];
}
