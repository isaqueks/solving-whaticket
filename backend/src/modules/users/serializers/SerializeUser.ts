import Queue from "../../queues/models/Queue";
import Company from "../../companies/models/Company";
import User from "../models/User";

/**
 * Forma pública de um usuário devolvida ao cliente (doc 04 §4).
 * Absorve o antigo `helpers/SerializeUser.ts`. Mantém o nome `SerializeUser`
 * para não alterar nada além do caminho de import nos consumidores (o
 * AuthService do módulo de auth continua importando por este nome).
 */
export interface SerializedUser {
  id: number;
  name: string;
  email: string;
  profile: string;
  companyId: number;
  company: Company | null;
  super: boolean;
  queues: Queue[];
  allTicket: string;
}

export const SerializeUser = async (user: User): Promise<SerializedUser> => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    companyId: user.companyId,
    company: user.company,
    super: user.super,
    queues: user.queues,
    allTicket: user.allTicket
  };
};
