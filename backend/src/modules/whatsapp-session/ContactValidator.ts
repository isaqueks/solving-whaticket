import AppError from "../../shared/errors/AppError";
// O import abaixo participa do grupo cíclico tickets ⇄ whatsapp-session — usar
// o singleton SEMPRE dentro do corpo dos métodos (binding CommonJS lazy).
import { whatsappService } from "../whatsapp/WhatsappService";

import { sessionManager } from "./SessionManager";
import { Session } from "./types";

/** Resultado do onWhatsApp do Baileys (forma do antigo CheckNumber). */
export interface IOnWhatsapp {
  jid: string;
  exists: boolean;
}

/**
 * Validações de número contra o WhatsApp pela conexão padrão da empresa
 * (antigos `CheckIsValidContact` e `CheckNumber` dos WbotServices).
 */
export class ContactValidator {
  /**
   * Lança ERR_WAPP_INVALID_CONTACT / ERR_WAPP_CHECK_CONTACT quando o número
   * não existe ou a checagem falha (antigo CheckIsValidContact).
   */
  public async checkIsValidContact(
    number: string,
    companyId: number
  ): Promise<void> {
    const defaultWhatsapp = await whatsappService.getDefaultWhatsApp(companyId);

    const wbot = sessionManager.getWbot(defaultWhatsapp.id);

    try {
      const isValidNumber = await wbot.onWhatsApp(`${number}`);
      if (!isValidNumber) {
        throw new AppError("invalidNumber");
      }
    } catch (err: any) {
      if (err.message === "invalidNumber") {
        throw new AppError("ERR_WAPP_INVALID_CONTACT");
      }
      throw new AppError("ERR_WAPP_CHECK_CONTACT");
    }
  }

  /**
   * Número canônico no WhatsApp, lançando ERR_CHECK_NUMBER 404 quando não
   * existe (antigo CheckContactNumber/CheckNumber).
   */
  public async checkNumber(
    number: string,
    companyId: number
  ): Promise<IOnWhatsapp> {
    const defaultWhatsapp = await whatsappService.getDefaultWhatsApp(companyId);

    const wbot = sessionManager.getWbot(defaultWhatsapp.id);
    const isNumberExit = await this.checker(number, wbot);

    if (!isNumberExit?.exists) {
      throw new AppError("ERR_CHECK_NUMBER", 404);
    }
    return isNumberExit;
  }

  private async checker(number: string, wbot: Session): Promise<IOnWhatsapp> {
    const [validNumber] = await wbot.onWhatsApp(`${number}@s.whatsapp.net`);
    return validNumber;
  }
}

export const contactValidator = new ContactValidator();
