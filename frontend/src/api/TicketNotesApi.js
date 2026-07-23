import { BaseApi } from "./BaseApi";

export class TicketNotesApi extends BaseApi {
  save(data) {
    return this.http.request({
      url: "/ticket-notes",
      method: "POST",
      data
    });
  }

  remove(id) {
    return this.http.request({
      url: `/ticket-notes/${id}`,
      method: "DELETE"
    });
  }

  list(params) {
    return this.http.request({
      url: "/ticket-notes/list",
      method: "GET",
      params
    });
  }
}

export const ticketNotesApi = new TicketNotesApi();
