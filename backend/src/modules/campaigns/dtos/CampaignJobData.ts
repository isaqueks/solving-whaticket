/**
 * Payloads dos jobs Bull da CampaignQueue (contratos do antigo
 * queues/campaignJobs.ts — nomes de job e formas preservados).
 */

/** Variável de substituição configurada em CampaignSettings ("variables"). */
export interface CampaignVariable {
  key: string;
  value: string;
}

/** Job "ProcessCampaign". */
export interface ProcessCampaignJobData {
  id: number;
  delay: number;
}

/** Job "PrepareContact". */
export interface PrepareContactJobData {
  contactId: number;
  campaignId: number;
  delay: number;
  variables: CampaignVariable[];
}

/** Job "DispatchCampaign". */
export interface DispatchCampaignJobData {
  campaignId: number;
  campaignShippingId: number;
  contactListItemId: number;
}

/** Configurações efetivas de disparo (defaults do antigo getSettings). */
export interface CampaignDispatchSettings {
  messageInterval: number;
  longerIntervalAfter: number;
  greaterInterval: number;
  variables: CampaignVariable[];
}
