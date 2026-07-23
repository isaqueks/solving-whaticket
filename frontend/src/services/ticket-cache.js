import { ticketsApi } from "../api/TicketsApi";
import { CACHE_KEY } from "./cache-key";


export class TicketCache {

  /**
   * @type {Map<string, any>}
   */
  static cache = new Map();

  static ticketsCacheKey(params) {
    const companyId = localStorage.getItem("companyId") || "";
    const userId = localStorage.getItem("userId") || "";
    const urlParams = new URLSearchParams(params).toString();
    return CACHE_KEY(`tickets/${companyId}/${userId}/${urlParams}`);
  }

  static async getTicketsNetwork(params) {
    const {
        searchParam,
        pageNumber,
        tags,
        users,
        status,
        date,
        updatedAt,
        showAll,
        queueIds,
        withUnreadMessages,
        unread
    } = params;

    const { data } = await ticketsApi.list({
      searchParam,
      pageNumber,
      tags,
      users,
      status,
      date,
      updatedAt,
      showAll,
      queueIds,
      withUnreadMessages,
      unread
    });

    if (!data.tickets) {
      return data;
    }

    for (const ticket of data.tickets) {
      TicketCache.cache.set(ticket.uuid, ticket);
    }

    try {
      if (String(pageNumber) === "1") {
        const key = TicketCache.ticketsCacheKey(params);
        localStorage.setItem(key, JSON.stringify(data));
      }
    }
    catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error updating local ticket cache:", err);
      }
    }

    return {
      ...data,
      __network: true
    };
  }

  static async getTicketByUUIDNetwork(uuid) {
    const { data } = await ticketsApi.showByUuid(uuid);
    if (!data.ticket) {
      return data;
    }

    TicketCache.cache.set(data.uuid, data);
    return {
      ...data,
      __network: true
    }
  }

  static async getTickets(params) {
    const key = TicketCache.ticketsCacheKey(params);
    try {
      const cached = JSON.parse(localStorage.getItem(key));
      for (const ticket of cached.tickets) {
        TicketCache.cache.set(ticket.uuid, ticket);
      }
      return {
        ...cached,
        __network: false
      }
    }
    catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error accessing local ticket cache:", err);
      }
    }
    return await this.getTicketsNetwork(params);
  }

  static async getTicketByUUID(uuid) {
    if (this.cache.has(uuid)) {
      return this.cache.get(uuid);
    }

    return await this.getTicketByUUIDNetwork(uuid);
  }

}