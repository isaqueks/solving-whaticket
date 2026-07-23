/**
 * Participante informado pelo frontend na criação/edição de um chat. O payload
 * traz o objeto de usuário inteiro; o domínio só usa o `id` (doc 04 §4 — evita
 * o `any[]` do CreateService/UpdateService originais).
 */
export interface ChatParticipantInput {
  id: number;
}
