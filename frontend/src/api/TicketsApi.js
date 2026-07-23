import { BaseApi } from "./BaseApi";

/**
 * Endpoints de tickets. Os métodos retornam a resposta axios crua (quem chama
 * desestrutura `.data`), mantendo o comportamento atual. O cache de tickets
 * (services/ticket-cache.js) usa esta classe como camada de rede.
 */
export class TicketsApi extends BaseApi {
  list(params) {
    return this.http.get("/tickets", { params });
  }

  showByUuid(uuid) {
    return this.http.get("/tickets/u/" + uuid);
  }

  create(data) {
    return this.http.post("/tickets", data);
  }

  update(id, data) {
    return this.http.put(`/tickets/${id}`, data);
  }
}

export const ticketsApi = new TicketsApi();
