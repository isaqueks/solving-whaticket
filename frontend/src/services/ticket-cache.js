import api from "./api";
import { CACHE_KEY } from "./cache-key";


export class TicketCache {

  /**
   * @type {Map<string, any>}
   */
  static cache = new Map();

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

    const { data } = await api.get("/tickets", {
      params: {
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
      },
    });

    if (!data.tickets) {
      return data;
    }

    for (const ticket of data.tickets) {
      TicketCache.cache.set(ticket.uuid, ticket);
    }

    try {
      if (String(pageNumber) === "1") {
        const urlParams = new URLSearchParams(params).toString();
        const key = CACHE_KEY(`tickets/${urlParams.toString()}`);
        localStorage.setItem(key, JSON.stringify(data));
      }
    }
    catch (err) {
      console.error("Error updating local ticket cache:", err);
    }

    return {
      ...data,
      __network: true
    };
  }

  static async getTicketByUUIDNetwork(uuid) {
    const { data } = await api.get("/tickets/u/" + uuid);
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
    const urlParams = new URLSearchParams(params).toString();
    const key = CACHE_KEY(`tickets/${urlParams.toString()}`);
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
      console.error("Error accessing local ticket cache:", err);
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