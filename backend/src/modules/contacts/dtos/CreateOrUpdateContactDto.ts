import { ContactExtraInfoDto } from "./ContactExtraInfoDto";

/**
 * Entrada de `ContactsService.createOrUpdate` (antigo
 * CreateOrUpdateContactService) — o caminho quente chamado por mensagem
 * recebida no wbot. Contrato idêntico ao `Request` original.
 *
 * `number` é opcional no tipo porque chamadores reais (ex.:
 * SyncGroupParticipantsService) passam `undefined` e o service resolve via
 * `lidNumber` — o tipo antigo exigia `string`, mas nunca foi verdade.
 */
export interface CreateOrUpdateContactDto {
  name: string;
  number?: string;
  isGroup: boolean;
  email?: string;
  profilePicUrl?: string;
  companyId: number;
  extraInfo?: ContactExtraInfoDto[];
  whatsappId?: number;
  taxId?: string;
  attachedToEmail?: string;
  keepName?: boolean;
  addressingMode?: string;
  lidNumber?: string;
}
