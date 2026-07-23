import { ContactExtraInfoDto } from "./ContactExtraInfoDto";

/** Entrada de GET /contact (vcard) — antigo GetContactService. */
export interface GetContactDto {
  name: string;
  number: string;
  companyId: number;
  email?: string;
  profilePicUrl?: string;
  extraInfo?: ContactExtraInfoDto[];
}
