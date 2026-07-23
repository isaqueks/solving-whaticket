import { logger } from "../../utils/logger";
// Validação de número no runtime da sessão (modules/whatsapp-session):
// singleton usado apenas dentro do corpo dos métodos.
import { contactValidator } from "../whatsapp-session/ContactValidator";
import ContactListItem from "./models/ContactListItem";

/**
 * Confere o número de um item de lista contra o WhatsApp e persiste o resultado
 * (`isWhatsappValid` + número canônico devolvido pelo Baileys).
 *
 * Extraído do bloco try/catch IDÊNTICO que o CreateService, o UpdateService e o
 * ImportContacts do legado repetiam (doc 04 §10 — regra de três). Número
 * inválido apenas loga; nunca interrompe o fluxo (comportamento original).
 */
export class ContactListItemNumberValidator {
  public async validateAndPersist(item: ContactListItem): Promise<void> {
    try {
      const response = await contactValidator.checkNumber(item.number, item.companyId);
      item.isWhatsappValid = response.exists;
      item.number = response.jid.replace(/[^0-9|-]/g, "");
      await item.save();
    } catch (e) {
      logger.error(`Número de contato inválido: ${item.number}`);
    }
  }
}
