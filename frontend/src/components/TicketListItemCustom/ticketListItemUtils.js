import { format, isSameDay, parseISO } from "date-fns";

/**
 * Formatação do horário da última mensagem no card do ticket: hora (HH:mm) se
 * for hoje, data (dd/MM/yyyy) caso contrário. Extraído tal-qual do JSX original
 * do TicketListItemCustom.
 */
export const formatTicketTime = (isoDate) =>
  isSameDay(parseISO(isoDate), new Date())
    ? format(parseISO(isoDate), "HH:mm")
    : format(parseISO(isoDate), "dd/MM/yyyy");
