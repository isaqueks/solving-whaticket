// Função pura: nenhum mock necessário (não importa models nem baileys).
import {
  isMainMenuRequest,
  resolveChatbotMenuReply,
  ResolveChatbotMenuReplyParams
} from "../ResolveChatbotMenuReply";

interface FakeQueue {
  id: number;
  name: string;
}

// ordem do menu = orderQueue da conexão (ids fora de ordem de propósito)
const boleto: FakeQueue = { id: 2, name: "Buscar boleto" };
const atendente: FakeQueue = { id: 1, name: "Falar com atendente" };
const queues = [boleto, atendente];

const FALLBACK_ID = 1;

const resolve = (
  overrides: Partial<ResolveChatbotMenuReplyParams<FakeQueue>> = {}
) =>
  resolveChatbotMenuReply<FakeQueue>({
    selectedOption: "",
    queues,
    menuSentCount: 0,
    fallbackQueueId: FALLBACK_ID,
    maxUseBotQueues: 3,
    hadRecentHumanMessage: false,
    ...overrides
  });

describe("resolveChatbotMenuReply", () => {
  describe("opção válida", () => {
    it("seleciona a fila pela posição no menu, respeitando a ordem recebida", () => {
      expect(resolve({ selectedOption: "1", menuSentCount: 1 })).toEqual({
        action: "select",
        queue: boleto
      });
      expect(resolve({ selectedOption: "2", menuSentCount: 1 })).toEqual({
        action: "select",
        queue: atendente
      });
    });

    it("ignora espaços em volta da opção", () => {
      expect(resolve({ selectedOption: " 2 ", menuSentCount: 1 })).toEqual({
        action: "select",
        queue: atendente
      });
      expect(resolve({ selectedOption: "\n1\t", menuSentCount: 1 })).toEqual({
        action: "select",
        queue: boleto
      });
    });

    it("aceita a opção mesmo antes do menu, com atendimento humano recente, sem fallback ou no limite", () => {
      expect(resolve({ selectedOption: "1", menuSentCount: 0 })).toEqual({
        action: "select",
        queue: boleto
      });
      expect(
        resolve({ selectedOption: "2", hadRecentHumanMessage: true })
      ).toEqual({ action: "select", queue: atendente });
      expect(
        resolve({
          selectedOption: "1",
          menuSentCount: 5,
          fallbackQueueId: null,
          maxUseBotQueues: 3
        })
      ).toEqual({ action: "select", queue: boleto });
    });

    it("mantém a conversão numérica de antes (+opção)", () => {
      expect(resolve({ selectedOption: "1.0", menuSentCount: 1 })).toEqual({
        action: "select",
        queue: boleto
      });
      expect(resolve({ selectedOption: "2.", menuSentCount: 1 })).toEqual({
        action: "select",
        queue: atendente
      });
    });

    it.each([
      "\uFF11", // dígito de largura total
      "1\uFE0F\u20E3", // emoji de tecla
      "1\u20E3", // tecla sem o seletor de variação
      "[1]",
      "[ 1 ]",
      "*[ 1 ]*", // o próprio formato do menu
      "*1*",
      "(1)",
      "1)"
    ])("aceita a opção escrita como %p", option => {
      expect(resolve({ selectedOption: option, menuSentCount: 1 })).toEqual({
        action: "select",
        queue: boleto
      });
    });
  });

  describe("opção fora do intervalo ou não numérica é inválida", () => {
    it.each([
      "3",
      "0",
      "-1",
      "1.5",
      "abc",
      "1 2",
      "Infinity",
      "[3]",
      "1 - boleto",
      "opção 1",
      "2 boletos"
    ])(
      "%p → fallback depois do menu",
      option => {
        expect(resolve({ selectedOption: option, menuSentCount: 1 })).toEqual({
          action: "fallback",
          queueId: FALLBACK_ID
        });
      }
    );

    it.each([null, undefined, "", "   "])(
      "corpo %p (mídia sem legenda etc.) não quebra e não seleciona fila",
      option => {
        expect(resolve({ selectedOption: option, menuSentCount: 0 })).toEqual({
          action: "sendMenu"
        });
        expect(resolve({ selectedOption: option, menuSentCount: 1 })).toEqual({
          action: "fallback",
          queueId: FALLBACK_ID
        });
      }
    );

    it("sem filas nenhuma opção é válida", () => {
      expect(
        resolve({ queues: [], selectedOption: "1", menuSentCount: 0 })
      ).toEqual({ action: "sendMenu" });
    });
  });

  describe("mensagem enviada antes do menu (sentBeforeMenu)", () => {
    it("não é resposta ao menu: silêncio, com ou sem fallback", () => {
      expect(
        resolve({ selectedOption: "bom dia", menuSentCount: 1, sentBeforeMenu: true })
      ).toEqual({ action: "silence" });
      expect(
        resolve({
          selectedOption: "bom dia",
          menuSentCount: 1,
          sentBeforeMenu: true,
          fallbackQueueId: null
        })
      ).toEqual({ action: "silence" });
    });

    it("não afeta opção válida nem #", () => {
      expect(
        resolve({ selectedOption: "1", menuSentCount: 1, sentBeforeMenu: true })
      ).toEqual({ action: "select", queue: boleto });
      expect(
        resolve({ selectedOption: "#", menuSentCount: 1, sentBeforeMenu: true })
      ).toEqual({ action: "sendMenu" });
    });

    it("não afeta o 1º menu nem a D4", () => {
      expect(
        resolve({ selectedOption: "Oi", menuSentCount: 0, sentBeforeMenu: true })
      ).toEqual({ action: "sendMenu" });
      expect(
        resolve({
          selectedOption: "Oi",
          menuSentCount: 0,
          sentBeforeMenu: true,
          hadRecentHumanMessage: true
        })
      ).toEqual({ action: "fallback", queueId: FALLBACK_ID });
    });
  });

  describe("# (voltar ao menu)", () => {
    it("sempre envia o menu, em qualquer estado", () => {
      expect(resolve({ selectedOption: "#" })).toEqual({ action: "sendMenu" });
      expect(resolve({ selectedOption: " # ", menuSentCount: 1 })).toEqual({
        action: "sendMenu"
      });
      expect(
        resolve({ selectedOption: "#", hadRecentHumanMessage: true })
      ).toEqual({ action: "sendMenu" });
      expect(
        resolve({
          selectedOption: "#",
          menuSentCount: 10,
          fallbackQueueId: null,
          maxUseBotQueues: 3
        })
      ).toEqual({ action: "sendMenu" });
    });

    it("isMainMenuRequest reconhece só o #", () => {
      expect(isMainMenuRequest("#")).toBe(true);
      expect(isMainMenuRequest("  #\n")).toBe(true);
      expect(isMainMenuRequest("##")).toBe(false);
      expect(isMainMenuRequest("# menu")).toBe(false);
      expect(isMainMenuRequest(null)).toBe(false);
      expect(isMainMenuRequest(undefined)).toBe(false);
    });
  });

  describe("primeira mensagem (menu ainda não enviado)", () => {
    it("envia o menu", () => {
      expect(resolve({ selectedOption: "Oi" })).toEqual({ action: "sendMenu" });
    });

    it("com atendimento humano recente e fallback: vai direto para a fila (D4)", () => {
      expect(
        resolve({ selectedOption: "Oi", hadRecentHumanMessage: true })
      ).toEqual({ action: "fallback", queueId: FALLBACK_ID });
    });

    it("com atendimento humano recente mas sem fallback: envia o menu", () => {
      expect(
        resolve({
          selectedOption: "Oi",
          hadRecentHumanMessage: true,
          fallbackQueueId: null
        })
      ).toEqual({ action: "sendMenu" });
      expect(
        resolve({
          selectedOption: "Oi",
          hadRecentHumanMessage: true,
          fallbackQueueId: undefined
        })
      ).toEqual({ action: "sendMenu" });
    });

    it.each([null, undefined])("contador %p conta como 0", count => {
      expect(resolve({ selectedOption: "Oi", menuSentCount: count })).toEqual({
        action: "sendMenu"
      });
      expect(
        resolve({
          selectedOption: "Oi",
          menuSentCount: count,
          hadRecentHumanMessage: true
        })
      ).toEqual({ action: "fallback", queueId: FALLBACK_ID });
    });

    it("envia o 1º menu mesmo com maxUseBotQueues 0", () => {
      expect(resolve({ selectedOption: "Oi", maxUseBotQueues: 0 })).toEqual({
        action: "sendMenu"
      });
      expect(
        resolve({
          selectedOption: "Oi",
          maxUseBotQueues: 0,
          fallbackQueueId: null
        })
      ).toEqual({ action: "sendMenu" });
    });
  });

  describe("resposta inválida depois do menu", () => {
    it("com fallback: vai para a fila de redirecionamento (D2)", () => {
      expect(resolve({ selectedOption: "Obg", menuSentCount: 1 })).toEqual({
        action: "fallback",
        queueId: FALLBACK_ID
      });
    });

    it("com fallback: redireciona mesmo acima do limite de menus", () => {
      expect(
        resolve({ selectedOption: "Obg", menuSentCount: 7, maxUseBotQueues: 3 })
      ).toEqual({ action: "fallback", queueId: FALLBACK_ID });
    });

    it("hadRecentHumanMessage não muda nada depois do menu", () => {
      expect(
        resolve({
          selectedOption: "Obg",
          menuSentCount: 1,
          hadRecentHumanMessage: true,
          fallbackQueueId: null
        })
      ).toEqual({ action: "sendMenu" });
    });

    describe("sem fallback (D3)", () => {
      const noFallback = { selectedOption: "Obg", fallbackQueueId: null };

      it("abaixo do limite: envia o menu de novo", () => {
        expect(resolve({ ...noFallback, menuSentCount: 1 })).toEqual({
          action: "sendMenu"
        });
        expect(resolve({ ...noFallback, menuSentCount: 2 })).toEqual({
          action: "sendMenu"
        });
      });

      it("no limite e acima dele: silêncio", () => {
        expect(resolve({ ...noFallback, menuSentCount: 3 })).toEqual({
          action: "silence"
        });
        expect(resolve({ ...noFallback, menuSentCount: 4 })).toEqual({
          action: "silence"
        });
      });

      it.each([0, -1, null, undefined])(
        "maxUseBotQueues %p = sem limite",
        maxUseBotQueues => {
          expect(
            resolve({ ...noFallback, menuSentCount: 50, maxUseBotQueues })
          ).toEqual({ action: "sendMenu" });
        }
      );

      it("fallbackQueueId 0 conta como sem fallback", () => {
        expect(
          resolve({ ...noFallback, fallbackQueueId: 0, menuSentCount: 3 })
        ).toEqual({ action: "silence" });
      });
    });
  });

  describe("sequência real do chamado #44 (TOP VEÍCULOS)", () => {
    // fila de transferência = 1 "Falar com atendente", maxUseBotQueues = 3
    const replay = (
      messages: string[],
      hadRecentHumanMessage: boolean,
      fallbackQueueId: number | null = FALLBACK_ID
    ) => {
      let menuSentCount = 0;
      let queueId: number | null = null;
      const actions: string[] = [];

      messages.forEach(selectedOption => {
        // com fila definida o verifyQueue não é mais chamado
        if (queueId !== null) {
          actions.push("ignored");
          return;
        }

        const decision = resolve({
          selectedOption,
          menuSentCount,
          fallbackQueueId,
          hadRecentHumanMessage
        });
        actions.push(decision.action);

        if (decision.action === "sendMenu") menuSentCount += 1;
        if (decision.action === "fallback") queueId = decision.queueId;
        if (decision.action === "select") queueId = decision.queue.id;
      });

      return { actions, menuSentCount, queueId };
    };

    const conversation = ["Ta bom", "Obg", "Agr.....pra ajudar", "👍"];

    it("sem atendimento humano recente: 1 menu e depois a fila de atendente", () => {
      expect(replay(conversation, false)).toEqual({
        actions: ["sendMenu", "fallback", "ignored", "ignored"],
        menuSentCount: 1,
        queueId: FALLBACK_ID
      });
    });

    it("com atendimento humano recente: nenhum menu", () => {
      expect(replay(conversation, true)).toEqual({
        actions: ["fallback", "ignored", "ignored", "ignored"],
        menuSentCount: 0,
        queueId: FALLBACK_ID
      });
    });

    it("sem fila de transferência: menu no máximo 3 vezes, depois silêncio", () => {
      expect(
        replay([...conversation, "oi", "alo"], false, null)
      ).toEqual({
        actions: [
          "sendMenu",
          "sendMenu",
          "sendMenu",
          "silence",
          "silence",
          "silence"
        ],
        menuSentCount: 3,
        queueId: null
      });
    });

    it("quem responde o menu com a opção segue o fluxo normal", () => {
      expect(replay(["Ta bom", "1", "Obg"], false)).toEqual({
        actions: ["sendMenu", "select", "ignored"],
        menuSentCount: 1,
        queueId: boleto.id
      });
    });
  });
});
