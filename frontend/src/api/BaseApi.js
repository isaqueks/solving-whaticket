import api from "../services/api";

/**
 * Base das classes de API por domínio (doc 03, fase F0.1).
 *
 * Guarda a instância axios já configurada (src/services/api.js — baseURL +
 * withCredentials). NÃO recria config de axios. Injeção pelo construtor com
 * default para permitir troca do http em teste sem reescrever as classes.
 */
export class BaseApi {
  constructor(http = api) {
    this.http = http;
  }
}
