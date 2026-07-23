import { Chat, Contact } from "baileys";
import { isArray } from "lodash";

import AppError from "../../shared/errors/AppError";
import Baileys from "./models/Baileys";

/** Entrada do upsert de contatos/chats sincronizados pelo Baileys. */
export interface UpsertBaileysDto {
  whatsappId: number;
  contacts?: Contact[];
  chats?: Chat[];
}

/**
 * Persistência dos dados sincronizados pelo Baileys (contatos/chats do
 * aparelho) — absorve os antigos `services/BaileysServices/` (CreateOrUpdate/
 * Show/Delete). Único ponto de acesso ao model Baileys (doc 04 §3).
 *
 * Os antigos `services/BaileysChatServices/` não tinham NENHUM importador
 * (código morto, verificado por grep na B5) e foram removidos; o model
 * BaileysChats permanece registrado no database/index por causa das tabelas
 * existentes.
 */
export class BaileysStore {
  /** Acumula contatos/chats no registro da conexão (antigo CreateOrUpdateBaileysService). */
  public async createOrUpdate({
    whatsappId,
    contacts,
    chats
  }: UpsertBaileysDto): Promise<Baileys> {
    const baileysExists = await Baileys.findOne({
      where: { whatsappId }
    });

    if (baileysExists) {
      const getChats = baileysExists.chats
        ? JSON.parse(JSON.stringify(baileysExists.chats))
        : [];
      const getContacts = baileysExists.contacts
        ? JSON.parse(JSON.stringify(baileysExists.contacts))
        : [];

      if (chats && isArray(getChats)) {
        getChats.push(...chats);
        getChats.sort();
        getChats.filter((v, i, a) => a.indexOf(v) === i);
      }

      if (contacts && isArray(getContacts)) {
        getContacts.push(...contacts);
        getContacts.sort();
        getContacts.filter((v, i, a) => a.indexOf(v) === i);
      }

      const newBaileys = await baileysExists.update({
        chats: JSON.stringify(getChats),
        contacts: JSON.stringify(getContacts)
      });

      return newBaileys;
    }

    const baileys = await Baileys.create({
      whatsappId,
      contacts: JSON.stringify(contacts),
      chats: JSON.stringify(chats)
    });

    return baileys;
  }

  /** Registro da conexão, lançando ERR_NO_BAILEYS_DATA_FOUND (antigo ShowBaileysService). */
  public async show(whatsappId: string | number): Promise<Baileys> {
    const baileysData = await Baileys.findOne({
      where: {
        whatsappId
      }
    });

    if (!baileysData) {
      throw new AppError("ERR_NO_BAILEYS_DATA_FOUND", 404);
    }

    return baileysData;
  }

  /** Remove o registro da conexão, se existir (antigo DeleteBaileysService). */
  public async delete(whatsappId: string | number): Promise<void> {
    const baileysData = await Baileys.findOne({
      where: {
        whatsappId
      }
    });

    if (baileysData) {
      await baileysData.destroy();
    }
  }
}
