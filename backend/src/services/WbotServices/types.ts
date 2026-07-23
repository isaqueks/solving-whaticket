import { WASocket } from "baileys";
import { Store } from "../../libs/store";

export type Session = WASocket & {
  id?: number;
  store?: Store;
};
