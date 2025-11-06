import api from "./api";


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

    return data;
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
    return await this.getTicketsNetwork(params);
  }

  static async getTicketByUUID(uuid) {
    if (this.cache.has(uuid)) {
      return this.cache.get(uuid);
    }

    return await this.getTicketByUUIDNetwork(uuid);
  }

}