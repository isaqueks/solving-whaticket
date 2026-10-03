/**
 * Decide o que fazer com a mensagem de um cliente sem fila, numa conexão com
 * mais de uma fila (menu principal do chatbot de filas).
 *
 * Função pura: não acessa banco nem Baileys, para poder ser testada isolada.
 * O chamador (verifyQueue) resolve os efeitos: entrar na fila, enviar o menu,
 * redirecionar para a fila de transferência ou não fazer nada.
 */

export type ChatbotMenuDecision<Q> =
  | { action: "select"; queue: Q }
  | { action: "fallback"; queueId: number }
  | { action: "sendMenu" }
  | { action: "silence" };

export interface ResolveChatbotMenuReplyParams<Q> {
  // corpo da mensagem do cliente (null/undefined em mídias sem legenda etc.)
  selectedOption: string | null | undefined;
  // filas da conexão, na ordem em que o menu as numera (orderQueue)
  queues: Q[];
  // menus já enviados neste ciclo do ticket (Tickets.amountUsedBotQueues)
  menuSentCount: number | null | undefined;
  // fila de redirecionamento da conexão (Whatsapps.transferQueueId)
  fallbackQueueId: number | null | undefined;
  // limite de envios do menu (Whatsapps.maxUseBotQueues); 0/null = sem limite
  maxUseBotQueues: number | null | undefined;
  // houve mensagem humana nossa recente neste ticket (D4)
  hadRecentHumanMessage: boolean;
  // a mensagem foi enviada antes do menu chegar ao cliente (rajada, reação,
  // entrega atrasada): não é uma resposta a ele
  sentBeforeMenu?: boolean;
}

const normalizeOption = (selectedOption: string | null | undefined): string =>
  String(selectedOption ?? "").trim();

// Número do menu digitado de outras formas comuns: dígitos de largura total
// ("１"), emoji de tecla ("1" + U+FE0F + U+20E3) e o próprio formato do menu
// ("*[ 1 ]*", "[1]", "(1)", "*1*", "1)"). Só aceita o número sozinho: não extrai
// dígitos de texto livre ("1 - boleto", "opção 1", "2 boletos").
const parseMenuIndex = (option: string): number => {
  // NFKC: largura total -> ASCII; remove o seletor de variação e o combinador de tecla
  const s = option.normalize("NFKC").replace(/[\uFE0F\u20E3]/g, "").trim();
  const m = s.match(/^\**\s*[[(]?\s*(\d{1,3})\s*[\])]?\s*\**\s*[.)]?$/);
  return m ? parseInt(m[1], 10) : NaN;
};

// "#" pede o menu principal de novo
export const isMainMenuRequest = (
  selectedOption: string | null | undefined
): boolean => normalizeOption(selectedOption) === "#";

export const resolveChatbotMenuReply = <Q>({
  selectedOption,
  queues,
  menuSentCount,
  fallbackQueueId,
  maxUseBotQueues,
  hadRecentHumanMessage,
  sentBeforeMenu
}: ResolveChatbotMenuReplyParams<Q>): ChatbotMenuDecision<Q> => {
  const option = normalizeOption(selectedOption);
  const sentCount = Number(menuSentCount) || 0;
  const maxUses = Number(maxUseBotQueues) || 0;

  // 1. opção válida (mesma regra de antes: queues[+opção - 1], agora com trim).
  // Vazio vira 0 e texto vira NaN: nenhum dos dois é índice válido.
  let queue = queues[+option - 1];
  if (queue === undefined) {
    const index = parseMenuIndex(option);
    if (index >= 1) {
      queue = queues[index - 1];
    }
  }
  if (queue !== undefined) {
    return { action: "select", queue };
  }

  // 2. "#" sempre volta ao menu
  if (option === "#") {
    return { action: "sendMenu" };
  }

  // 3. respondendo a um atendimento humano recente: direto para a fila, sem menu
  if (sentCount === 0 && hadRecentHumanMessage && fallbackQueueId) {
    return { action: "fallback", queueId: fallbackQueueId };
  }

  // 4. o menu ainda não foi mostrado neste ciclo
  if (sentCount === 0) {
    return { action: "sendMenu" };
  }

  // 4b. mensagem enviada antes do menu: não é resposta a ele; a próxima decide
  if (sentBeforeMenu) {
    return { action: "silence" };
  }

  // 5. resposta inválida depois do menu: o cliente quer um atendente
  if (fallbackQueueId) {
    return { action: "fallback", queueId: fallbackQueueId };
  }

  // 6. sem fila de redirecionamento: menu até o limite, depois silêncio
  if (maxUses > 0 && sentCount >= maxUses) {
    return { action: "silence" };
  }

  // 7.
  return { action: "sendMenu" };
};

export default resolveChatbotMenuReply;
