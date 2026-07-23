/**
 * Entrada de `PlansService.create` (doc 04 §4). Espelha o body aceito pelo
 * antigo `CreatePlanService` — `name` obrigatório, o resto opcional.
 */
export interface CreatePlanDto {
  name: string;
  users?: number;
  connections?: number;
  queues?: number;
  value?: number;
  useCampaigns?: boolean;
  useSchedules?: boolean;
  useInternalChat?: boolean;
  useExternalApi?: boolean;
  useKanban?: boolean;
  useOpenAi?: boolean;
  useIntegrations?: boolean;
}
