import { BaseApi } from "./BaseApi";

export class MessagesApi extends BaseApi {
  /** GET /messages/:ticketId — página de mensagens do ticket (params: { pageNumber }). */
  list(ticketId, params) {
    return this.http.get(`/messages/${ticketId}`, { params });
  }

  listAllMe(params) {
    return this.http.get("/messages-allMe", { params });
  }

  /**
   * POST /messages/:ticketId — envia mensagem no ticket. O backend usa a MESMA
   * rota para texto (JSON: body/quotedMsg/editMsg) e mídia/áudio (FormData);
   * por isso um único método com payload polimórfico.
   */
  send(ticketId, payload) {
    return this.http.post(`/messages/${ticketId}`, payload);
  }

  /** POST /messages/forward — encaminha mensagens para outro contato. */
  forward(payload) {
    return this.http.post("/messages/forward", payload);
  }
}

export const messagesApi = new MessagesApi();
