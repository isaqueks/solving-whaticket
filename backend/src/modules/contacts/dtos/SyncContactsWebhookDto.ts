/**
 * Payload de POST /webhook/contacts/sync — integração CUSTOM do dono do
 * projeto (antigo ContactUpdateWebhookController). Contrato CONGELADO:
 * `companyId` vem no corpo (a rota autentica por token, não por sessão).
 */
export interface SyncContactsWebhookItem {
  name: string;
  number: string;
  taxId?: string;
  email?: string;
  attachedToEmail?: string;
}

export interface SyncContactsWebhookDto {
  data: SyncContactsWebhookItem[];
  companyId: number;
}
