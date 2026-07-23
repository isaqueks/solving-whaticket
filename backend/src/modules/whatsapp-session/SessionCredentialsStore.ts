import type {
  AuthenticationCreds,
  AuthenticationState,
  SignalDataTypeMap
} from "baileys";
import { BufferJSON, initAuthCreds, proto } from "baileys";

import Whatsapp from "../whatsapp/models/Whatsapp";
import { logger } from "../../utils/logger";

const KEY_MAP: { [T in keyof SignalDataTypeMap]: string } = {
  "pre-key": "preKeys",
  session: "sessions",
  "sender-key": "senderKeys",
  "app-state-sync-key": "appStateSyncKeys",
  "app-state-sync-version": "appStateVersions",
  "sender-key-memory": "senderKeyMemory",
  "lid-mapping": "lidMappings",
  "device-list": "deviceList",
  tctoken: "tctoken",
  "identity-key": "identityKey"
};

/** Estado de autenticação do Baileys + persistidor (forma do antigo authState). */
export interface SessionAuthState {
  state: AuthenticationState;
  saveState: () => void;
}

/**
 * Credenciais Baileys persistidas na coluna `session` da conexão (antigo
 * `helpers/authState.ts`). CUIDADO byte a byte: o (de)serializador usa o
 * BufferJSON do Baileys e qualquer mudança corrompe a sessão salva.
 */
export class SessionCredentialsStore {
  public async getAuthState(whatsapp: Whatsapp): Promise<SessionAuthState> {
    let creds: AuthenticationCreds;
    // `any` justificado (doc 04 §4): o mapa de chaves de sinal do Baileys é um
    // dicionário heterogêneo sem tipo público — comportamento original mantido.
    let keys: any = {};

    const saveState = async () => {
      try {
        await whatsapp.update({
          session: JSON.stringify({ creds, keys }, BufferJSON.replacer, 0)
        });
      } catch (error) {
        logger.error(
          { err: error },
          "Falha ao persistir credenciais da sessão do WhatsApp %d",
          whatsapp.id
        );
      }
    };

    if (whatsapp.session && whatsapp.session !== null) {
      const result = JSON.parse(whatsapp.session, BufferJSON.reviver);
      creds = result.creds;
      keys = result.keys;
    } else {
      creds = initAuthCreds();
      keys = {};
    }

    return {
      state: {
        creds,
        keys: {
          get: (type, ids) => {
            const key = KEY_MAP[type];
            return ids.reduce((dict: any, id) => {
              let value = keys[key]?.[id];
              if (value) {
                if (type === "app-state-sync-key") {
                  value = proto.Message.AppStateSyncKeyData.create(value);
                }
                dict[id] = value;
              }
              return dict;
            }, {});
          },
          set: (data: any) => {
            // eslint-disable-next-line no-restricted-syntax, guard-for-in
            for (const i in data) {
              const key = KEY_MAP[i as keyof SignalDataTypeMap];
              keys[key] = keys[key] || {};
              Object.assign(keys[key], data[i]);
            }
            saveState();
          }
        }
      },
      saveState
    };
  }
}
