/**
 * Payloads dos JWTs legados emitidos no login (antigo helpers/CreateTokens.ts).
 *
 * ATENÇÃO: a chave `usarname` (typo de "username") é PROPOSITAL — é o nome
 * exato gravado nos tokens desde sempre e sistemas externos podem decodificar
 * por esse nome. Não corrigir sem uma migração combinada com os consumidores.
 */
export interface AccessTokenPayload {
  usarname: string;
  profile: string;
  id: number;
  companyId: number;
}

export interface RefreshTokenPayload {
  id: number;
  tokenVersion: number;
  companyId: number;
}
