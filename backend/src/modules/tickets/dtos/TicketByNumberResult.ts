import Ticket from "../models/Ticket";

/**
 * Resultado de `TicketByNumberService.getOrCreateByNumber`. O contrato HTTP
 * original devolve 200 com `{ error }` nos fluxos de falha (número inválido /
 * contato inexistente) — por isso o erro é dado, não exceção.
 */
export interface TicketByNumberResult {
  ticket?: Ticket;
  error?: string;
}
