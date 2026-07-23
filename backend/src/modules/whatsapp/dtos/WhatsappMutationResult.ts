import Whatsapp from "../models/Whatsapp";

/**
 * Saída de `WhatsappService.create` e `.update`: além da conexão criada/
 * alterada, devolve a conexão que deixou de ser a padrão (quando houve troca),
 * para o controller emitir a atualização das duas — forma original dos antigos
 * Create/UpdateWhatsAppService.
 */
export interface WhatsappMutationResult {
  whatsapp: Whatsapp;
  oldDefaultWhatsapp: Whatsapp | null;
}
