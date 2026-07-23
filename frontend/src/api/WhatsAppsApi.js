import { BaseApi } from "./BaseApi";

export class WhatsAppsApi extends BaseApi {
  list() {
    return this.http.get("/whatsapp/?session=0");
  }

  // NewTicketModal filtra por empresa e sessão (params explícitos, mantendo a
  // URL /whatsapp original desse consumidor — não o /whatsapp/?session=0 de list).
  listByCompany(companyId) {
    return this.http.get("/whatsapp", { params: { companyId, session: 0 } });
  }
}

export const whatsAppsApi = new WhatsAppsApi();
