import { BaseApi } from "./BaseApi";

export class ContactsApi extends BaseApi {
  list(params) {
    return this.http.request({
      url: "/contacts/",
      method: "GET",
      params
    });
  }

  remove(id) {
    return this.http.request({
      url: `/contacts/${id}`,
      method: "DELETE"
    });
  }

  upload(formData) {
    return this.http.request({
      url: "/contacts/upload",
      method: "POST",
      data: formData
    });
  }

  importContacts() {
    return this.http.request({
      url: "/contacts/import",
      method: "POST"
    });
  }

  /** GET /contacts/:id/participants — participantes de um contato de grupo. */
  participants(contactId) {
    return this.http.get(`/contacts/${contactId}/participants`);
  }
}

export const contactsApi = new ContactsApi();
