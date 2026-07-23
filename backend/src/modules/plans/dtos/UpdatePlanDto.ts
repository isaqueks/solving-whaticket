/**
 * Entrada de `PlansService.update` (doc 04 §4). Todos os campos opcionais — só
 * os presentes no body são gravados (comportamento original do UpdatePlanService).
 */
export interface UpdatePlanDto {
  name?: string;
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
