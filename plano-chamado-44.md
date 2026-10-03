# Plano: chamado #44, "CHAT - MENSAGEM CLIENTE"

> Solicitante: Carol (TOP VEÍCULOS) · Natureza: problema · Prioridade: média

## 1. O problema

> "quando o cliente não escolhe a opção 1 ou 2 ele fica recebendo essas mensagens no meio da conversa, o sistema deveria entender que ele quer falar com o atendente e direcionar e cancelar essas mensagens."

O print do chamado mostra esta sequência:

| Hora  | Quem       | Mensagem |
|-------|------------|----------|
| 08:34 | atendente  | "Bom dia Carlos, … Vou deixar agendado aqui para sexta dia 11/09" |
| 10:43 | cliente    | "Ta bom" |
| 10:43 | bot        | **Menu**: "Bem vindo à TOP VEÍCULOS! Escolha uma opção: [1] Buscar boleto / [2] Falar com atendente" |
| 10:43 | cliente    | "Obg" |
| 10:43 | bot        | **Menu de novo** |
| 10:43 | cliente    | "Agr.....pra ajudar" |
| 10:43 | bot        | **Menu de novo** (e assim por diante) |

O menu vem do chatbot de filas da conexão: `greetingMessage` mais a lista das filas vinculadas, gerada em `verifyQueue` → `botText`.

## 1.1 Dados de produção (consultados em modo somente leitura em 2026-09-30)

**Configuração** (existe uma única conexão em produção):

| Item | Valor |
|---|---|
| Conexão | id 3, "Relacionamento com o cliente Top Veiculos", empresa 2 |
| `maxUseBotQueues` / `timeUseBotQueues` | 3 / 0 |
| `transferQueueId` / `timeToTransfer` | **1 ("Falar com atendente")** / 15 min |
| `expiresTicket` | **120** (encerra tickets `open` 120 **min** depois da última mensagem, se essa mensagem foi nossa; ver `wbotClosedTickets.ts:68-100`) |
| Filas | 2 "Buscar boleto" (`orderQueue` 1, **integração typebot** "Buscar Boleto", sem opções); 1 "Falar com atendente" (`orderQueue` 2, **sem saudação**, sem opções) |
| Settings da empresa 2 | `chatBotType=text`, `scheduleType=disabled`, `userRating=disabled` |

**O caso do print** (contato 31902, ticket 1240; o mesmo ticket é reaproveitado desde 2025-06):

- O contato está em modo **LID**. As mensagens do bot e do cliente são gravadas com `remoteJid ...@lid`. As mensagens que o atendente manda pelo sistema são gravadas com `...@s.whatsapp.net`.
- 09/09 13:24: o atendente responde. 19:20: o cliente responde e recebe o menu. Entre um e outro o ticket foi encerrado pelo `expiresTicket` (120 min).
- Cada mensagem do cliente recebeu um menu em até 0,5 s: 3 menus em 09/09 e 4 em 10/09 às 10:43, incluindo uma mensagem pessoal delicada. Às 15:45 um emoji gerou mais um menu, depois de um novo encerramento automático.
- Nenhum "Opção inválida" nesse ticket. A busca `remoteJid = <número>@s.whatsapp.net` encontra a última mensagem **do atendente**, não o menu, então o menu é sempre considerado "diferente" e é reenviado. **Hipótese do §2.2-3 confirmada.**

**Impacto nos últimos 30 dias** (empresa 2):

| Métrica | Valor |
|---|---|
| Menus enviados | 335 (em 131 tickets) |
| Ticket-dias com 2 ou mais menus | 78 |
| Máximo de menus num ticket em um dia | **12** |
| Respostas "1" ou "2" dos clientes | 100 |
| "Opção inválida" enviadas | 23 |
| Contatos que escreveram | 331, **todos em modo LID** (menu para um contato `pn` só até 27/02/2026) |

Como hoje todo o tráfego é LID, o bug afeta praticamente todos os atendimentos.

## 2. Diagnóstico (causa raiz)

### 2.1 Por que o menu aparece "no meio da conversa"

`FindOrCreateTicketService` (`backend/src/services/TicketServices/FindOrCreateTicketService.ts:37-53`): quando chega qualquer mensagem num ticket **fechado**, o ticket volta para `pending` com `userId = null` e `queueId = null`. Isso também vale para as mensagens `fromMe` enviadas pelo celular. Depois, em `handleMessage` (`wbotMessageListener.ts:2005-2012`), qualquer ticket sem fila, sem usuário e de uma conexão com filas cai em `verifyQueue`, que envia o menu.

Então, se o atendente encerrou o ticket (ou ele foi encerrado automaticamente) e o cliente respondeu "Ta bom", o bot recomeça do zero. **Esse comportamento é do Whaticket original.** O problema real é o que acontece depois do primeiro menu.

Na TOP VEÍCULOS isso acontece o tempo todo por causa do `expiresTicket = 120`. O atendente responde, 2 h depois o ticket é encerrado automaticamente, e qualquer resposta posterior do cliente ("ok", "obrigado", "pago sexta") reabre o ticket sem fila e dispara o menu. Para o cliente, é "no meio da conversa". Ver a Decisão D4.

### 2.2 Por que o menu se repete sem fim

Em `verifyQueue` (`wbotMessageListener.ts:1036-1307`), quando a resposta não é uma opção válida (`choosenQueue` indefinido), o código cai no `else` da linha 1274:

1. **Limite de envios morto.** A regra `maxUseBotQueues` (padrão 3, linha 1276) compara `ticket.amountUsedBotQueues >= maxUseBotQueues`, mas **`amountUsedBotQueues` nunca é incrementado em lugar nenhum do código** (busca por grep: só aparece no model e na migration). Por isso o limite nunca é atingido. A coluna é `NULL` por padrão, e `null >= 3` dá `false`.
2. **Regra de intervalo quebrada** (linhas 1285-1300):
   - `dataLimite.setMinutes(chatbotAt.getMinutes() + timeUseBotQueues)` pega os *minutos* do `chatbotAt` e aplica na data **atual**. A conta está errada.
   - `timeUseBotQueues !== "0"`: a coluna é `INTEGER` no banco (migration `20231214143411`), mas o model declara `string`. A comparação com `"0"` é sempre verdadeira.
   - A regra também exige `amountUsedBotQueues !== 0`, que hoje é `null`. Então ela passa e é anulada em seguida.
   - Hoje isso é "inofensivo" só porque o contador nunca anda. **Quando o contador for corrigido, essa regra passa a silenciar o bot de forma aleatória.** Ela precisa ser corrigida junto.
3. **"Opção inválida" nunca aparece** (linhas 1145-1170). A ideia original era: 1ª resposta inválida → "Opção inválida"; 2ª → silêncio. Mas a última mensagem do bot é buscada por `remoteJid: ${contact.number}@s.whatsapp.net`, sem filtrar por ticket ou empresa:
   - contatos em modo **LID** (`addressingMode = 'lid'`, suportado desde a migration `20251019231540`) gravam `remoteJid` como `...@lid`, então a busca não encontra nada e o menu é reenviado;
   - a busca também pode pegar mensagens de outro ticket.

   O print (menu repetido, sem nenhum "Opção inválida") bate com isso.
4. **A transferência por tempo não resolve.** `wbotTransferTicketQueue.ts:41` usa `ticket.updatedAt` como base, e cada mensagem atualiza o `updatedAt`. Enquanto o cliente continua escrevendo, o ticket nunca passa do `timeToTransfer`.

### 2.3 O mesmo problema nos submenus da fila

`handleChartbot` (`wbotMessageListener.ts:1387-1664`) tem o mesmo defeito dentro de uma fila com opções (`QueueOptions`): resposta inválida → o submenu é reenviado a cada mensagem. Numa opção "folha" (sem filhos), a mensagem da folha é repetida a cada mensagem do cliente.

## 3. Comportamento proposto

0. Se o cliente está respondendo a uma conversa **humana recente** (mensagem nossa, não automática, neste ticket nas últimas X horas; padrão 24, configurável por conexão) → vai direto para a fila de redirecionamento, **sem menu** (D4, §4.5).
1. Caso contrário, o cliente sem fila manda a 1ª mensagem → recebe o menu **uma vez** (como hoje).
2. Ele responde com uma opção válida → segue o fluxo atual (fila escolhida, saudação da fila, integração ou prompt, horário de atendimento).
3. Ele responde com **qualquer outra coisa** → o sistema entende que o cliente quer um atendente:
   - o ticket vai para a **fila de redirecionamento** da conexão (`Whatsapps.transferQueueId`, o campo "Fila de Transferência" que já existe na seção "Redirecionamento de Fila" do modal da conexão);
   - envia a saudação dessa fila, se houver (mesmo fluxo de quando o cliente escolhe a opção);
   - **nenhum menu é enviado de novo** enquanto o ticket não voltar para "sem fila" (encerramento e reabertura, ou `#`).
4. Se a conexão **não** tiver fila de redirecionamento configurada, o fallback é seguro: o menu é enviado no máximo `maxUseBotQueues` vezes (agora funcionando de fato) e depois o bot fica em silêncio. O ticket continua pendente sem fila, visível para quem tem `allTicket`.
5. `#` continua voltando ao menu inicial (e zera o contador).

> **Por que reaproveitar `transferQueueId`?** A seção já existe na tela, com a descrição "Selecione uma fila para os contatos que não possuem fila serem redirecionados", que é exatamente o caso. Isso evita migration e campo novo. A transferência por tempo (`timeToTransfer`) continua independente: com `timeToTransfer` vazio ou 0, o cron ignora a conexão, mas a fila passa a ser usada no redirecionamento imediato. Se preferirem separar os conceitos, veja a Decisão D1.

## 4. Alterações

### 4.1 Backend: lógica de decisão (nova, pura e testável)

**Novo arquivo** `backend/src/helpers/ResolveChatbotMenuReply.ts`

Uma função pura, sem acesso a banco nem a Baileys, que decide o que fazer com a resposta do cliente ao menu principal:

```ts
type MenuDecision =
  | { action: "select"; queue: Queue }        // opção válida
  | { action: "fallback"; queueId: number }   // resposta inválida após o menu → fila de redirecionamento
  | { action: "sendMenu" }                    // ainda não mostrou o menu (ou pediu '#')
  | { action: "silence" };                    // sem fallback e limite atingido

resolveChatbotMenuReply({
  selectedOption,          // corpo da mensagem
  queues,                  // filas da conexão, na ordem de orderQueue
  menuSentCount,           // ticket.amountUsedBotQueues ?? 0
  fallbackQueueId,         // whatsapp.transferQueueId
  maxUseBotQueues,         // whatsapp.maxUseBotQueues
  hadRecentHumanMessage,   // §4.5 (D4)
})
```

As regras em ordem:

1. `+selectedOption.trim()` corresponde a uma fila → `select`;
2. `#` → `sendMenu`;
3. `menuSentCount === 0`, `hadRecentHumanMessage` e `fallbackQueueId` definido → `fallback` (D4, §4.5);
4. `menuSentCount === 0` → `sendMenu`;
5. `fallbackQueueId` definido → `fallback`;
6. `maxUseBotQueues > 0 && menuSentCount >= maxUseBotQueues` → `silence`;
7. senão → `sendMenu`.

Esse helper é o que viabiliza os testes unitários, porque `wbotMessageListener.ts` importa o Baileys (ESM) e muitos models.

### 4.2 Backend: `verifyQueue` (`services/WbotServices/wbotMessageListener.ts:1036`)

- **Extrair** o bloco `if (choosenQueue) { … }` (linhas 1176-1272) para uma função interna `enterQueue(queue, { wbot, msg, ticket, contact, mediaSent })`. O comportamento é o mesmo; a extração serve para reaproveitar o bloco no fallback. O bloco inclui:
  - atualizar a fila e o `chatbot`;
  - checar o horário da fila;
  - iniciar a integração ou o prompt;
  - enviar a saudação e a mídia da fila.
- Trocar o `else` (linhas 1274-1305) pelo `switch` sobre `resolveChatbotMenuReply(...)`:
  - `select` → `enterQueue(choosenQueue)`;
  - `fallback`:
    - carregar a fila com `Queue.findOne({ where: { id: transferQueueId, companyId }, include: options })`. Ela **não precisa** estar vinculada à conexão, mas precisa ser da mesma empresa;
    - se não existir (fila apagada) → registrar um `logger.warn` e tratar como `silence`;
    - **claim atômico** contra condição de corrida (o `messages.upsert` processa mensagens em paralelo com `forEach(async)`, e o cliente costuma mandar várias seguidas): `Ticket.update({ queueId }, { where: { id: ticket.id, queueId: null } })`. Só segue para `enterQueue` se `affectedRows === 1`. Assim a saudação da fila não sai duplicada;
    - `logger.info` com o ticket e a fila, para auditoria;
  - `sendMenu` → `botText()` e depois incrementar o contador:
    - `Ticket.update({ amountUsedBotQueues: Sequelize.literal('COALESCE("amountUsedBotQueues",0)+1') }, { where: { id } })`;
    - atenção: `ticket.increment` com `NULL` resulta em `NULL` no Postgres;
  - `silence` → `return`.
- **Simplificar `botText`**:
  - remover a busca da última mensagem por `remoteJid` e a lógica de "Opção inválida" (linhas 1145-1170), porque passam a ser decididas pelo helper;
  - o texto "Opção inválida" deixa de existir no fluxo com fallback. Sem fallback, fica só o menu até o limite (ver Decisão D3).
- **Regra `timeUseBotQueues`** (linhas 1285-1300): corrigir a conta para `chatbotAt.getTime() + Number(timeUseBotQueues) * 60_000` e trocar a comparação para `Number(timeUseBotQueues) > 0`. Ela deve rodar **só** no caminho `sendMenu`, nunca antes do `fallback`, senão ela silencia o redirecionamento.
- **Model**: corrigir o tipo `timeUseBotQueues: number` em `models/Whatsapp.ts:139` (hoje é `string`) e ajustar os pontos que usam o campo.

### 4.3 Backend: zerar o contador nos pontos certos

O contador precisa representar "menus enviados **neste ciclo** do ticket":

| Local | Mudança |
|---|---|
| `FindOrCreateTicketService.ts:39-44` (reabre um ticket `closed`) | incluir `amountUsedBotQueues: 0` no `update` |
| `FindOrCreateTicketService.ts:63-69` (reabre grupo) e `:96-102` (reabre um ticket das últimas 2h) | idem |
| `FindOrCreateTicketService.ts:119` (`Ticket.create`) | `amountUsedBotQueues: 0` |
| `wbotMessageListener.ts:1810` (`#` no `handleMessage`) e `:1411` (`#` no `handleChartbot`) | incluir `amountUsedBotQueues: 0` junto com `queueId: null` |
| `UpdateTicketService.ts:257` | se `status === "closed"`, zerar também (é redundante com a reabertura, mas deixa o dado limpo) |

Não precisa de migration: a coluna `Tickets.amountUsedBotQueues` já existe (`20230303223001`). Os tickets atuais com `NULL` são tratados como 0 pelo `?? 0` e pelo `COALESCE`.

### 4.4 Backend: submenus da fila (`handleChartbot`, linhas 1387-1664)

Mesmo princípio: resposta fora do submenu = quer um atendente.

- Nível raiz das opções da fila (`queueOptionId` nulo, `!dontReadTheFirstQuestion`, opção não encontrada, mensagem diferente de `#` e `0`) → `ticket.update({ chatbot: false, queueOptionId: null })` e `return`. O ticket **continua na fila atual**, pendente para os atendentes dela.
- Nível interno (`queueOptionId` definido, `count > 1`, opção não encontrada, mensagem diferente de `0`) → idem.
- Opção folha (sem filhos): depois de enviar a mensagem da folha, `chatbot: false`. Assim ela não se repete a cada mensagem do cliente.
- Preservar:
  - `0` volta ao menu anterior;
  - `#` volta ao menu inicial (funciona mesmo com `chatbot: false`, pelo tratamento da linha 1810);
  - quando só existe 1 filha, qualquer resposta avança (`count == 1`).

> Em produção não há nenhuma `QueueOption` ("Buscar boleto" é typebot). Este item **não afeta o chamado**: é a mesma classe de bug, mas hoje é código morto para a TOP VEÍCULOS. Recomendo deixar para depois (D5).

### 4.5 Backend: não mostrar o menu em conversa humana recente (D4)

No `verifyQueue`, **antes** de decidir `sendMenu` com `menuSentCount === 0`, verificar se houve mensagem **humana** nossa neste ticket dentro de uma janela de tempo:

```ts
const recentHuman = await Message.findOne({
  where: {
    ticketId: ticket.id,
    fromMe: true,
    createdAt: { [Op.gte]: subHours(new Date(), windowHours) },
    body: { [Op.notLike]: "\u200e%" }   // mensagens do bot/sistema começam com \u200e
  },
  attributes: ["id"]
});
```

- Se encontrar e houver `transferQueueId` → `fallback` direto, sem enviar menu.
- A janela é **configurável por conexão** no campo novo `Whatsapps.skipMenuAfterHumanHours` (ver §4.7), com padrão **24**; `0` ou vazio desliga a verificação, e aí nem a consulta é feita. O resultado entra no helper como `hadRecentHumanMessage: boolean`, para ficar coberto por teste.
- `windowHours = Number(whatsapp.skipMenuAfterHumanHours) || 0`. O `ShowWhatsAppService`, chamado no início do `verifyQueue`, já traz todas as colunas da conexão.
- Pode usar o índice de `Messages` por `ticketId` (migrations `20250808231540-add-messageIndexes` e `20260711000000-add-performance-indexes`). Conferir com `EXPLAIN` antes do deploy.
- Pelos dados de produção: 09/09 19:20 (resposta 6 h depois do atendente), 10/09 10:43 (2 h depois das mensagens do atendente pelo celular) e 10/09 15:45 (4 h depois) teriam ido direto para "Falar com atendente", **sem nenhum menu**.

### 4.6 Frontend: modal da conexão (`frontend/src/components/WhatsAppModal/index.js`)

Um campo novo (a janela da D4) e o texto do campo que já existe:

- **Campo novo** na seção "Redirecionamento de Fila", ao lado de "Transferir após x (minutos)":
  - `Field` numérico `skipMenuAfterHumanHours`, rótulo **"Pular menu se houve atendimento nas últimas X horas"**;
  - texto de ajuda: "0 desativa. O cliente vai direto para a Fila de Transferência.";
  - `initialState`: `skipMenuAfterHumanHours: 24` (linha ~79), para conexões novas;
  - o valor vai no payload sem mudança, porque `handleSaveWhatsApp` envia `...values`.

- Seção "Redirecionamento de Fila" (linhas 355-385):
  - atualizar a descrição (`whatsappModal.form.queueRedirectionDesc` em `translate/languages/pt.js:139` e `es.js:138`; `en.js` não tem essa chave, então precisa ser adicionada) para algo como: *"Fila para onde o contato é enviado quando não escolhe uma opção válida do menu. Opcionalmente, também transfere automaticamente após X minutos sem fila."*;
  - deixar claro na interface que "Transferir após x (minutos)" é opcional: com o campo vazio ou 0, só o redirecionamento por resposta inválida fica ativo.
- Opcional: permitir limpar a "Fila de Transferência". Verificar se o `QueueSelect` com `multiple={false}` aceita desmarcar; se não aceitar, incluir a opção "Nenhuma".
- Sem mudança no payload: `transferQueueId` já é enviado em `handleSaveWhatsApp` (linha 132) e já é persistido por `UpdateWhatsAppService`.

### 4.7 Backend: campo `skipMenuAfterHumanHours` na conexão

| Arquivo | Mudança |
|---|---|
| **novo** `backend/src/database/migrations/20260930000000-add-skipMenuAfterHumanHours-to-whatsapps.ts` | `addColumn("Whatsapps", "skipMenuAfterHumanHours", { type: INTEGER, allowNull: true, defaultValue: 24 })`; `down` → `removeColumn`. A conexão que já existe em produção passa a valer 24 automaticamente. |
| `backend/src/models/Whatsapp.ts` | `@Default(24) @Column skipMenuAfterHumanHours: number;` |
| `backend/src/controllers/WhatsAppController.ts` | incluir no `interface WhatsappData` e na desestruturação/repasse do `store` (linhas ~25-85). O `update` já repassa o `req.body` inteiro. |
| `backend/src/services/WhatsappService/CreateWhatsAppService.ts` | incluir no `Request`, no default (`= 24`) e no `Whatsapp.create` |
| `backend/src/services/WhatsappService/UpdateWhatsAppService.ts` | incluir no `WhatsappData`, na desestruturação e no `whatsapp.update` |

Validação: inteiro `>= 0` (Yup, no `UpdateWhatsAppService`). Um valor negativo ou vazio vira 0 (desligado).

### 4.8 Testes

**Novo** `backend/src/helpers/__tests__/ResolveChatbotMenuReply.spec.ts`

- Caminho: `testMatch` é `**/__tests__/**/*.spec.ts`. O `collectCoverageFrom` só cobre `services/**`, então, se quiserem cobertura, colocar o helper em `services/WbotServices/` em vez de `helpers/`.
- Casos:
  1. opção válida `"1"` / `"2"` → `select` com a fila certa (respeitando `orderQueue`);
  2. `" 2 "` e `"2."`: decidir se normaliza (`trim` e só dígitos). **Recomendo `trim()`** e manter o resto como está;
  3. 1ª mensagem (`menuSentCount 0`) com texto qualquer ("Ta bom") → `sendMenu`;
  4. 2ª mensagem inválida ("Obg") com fallback → `fallback`;
  5. 2ª inválida sem fallback, abaixo do limite → `sendMenu`;
  6. sem fallback, no limite → `silence`;
  7. `#` → `sendMenu`;
  8. `menuSentCount` `null`/`undefined` → tratado como 0;
  9. opção fora do intervalo (`"3"` com 2 filas) → tratada como inválida;
  10. `hadRecentHumanMessage` com fallback e `menuSentCount 0` → `fallback` (D4);
  11. `hadRecentHumanMessage` sem fallback → `sendMenu` (comportamento de hoje).

  Manual: com o campo em 0 na conexão, o cliente que responde depois do atendente recebe o menu 1× (a D4 fica desligada); com 24, vai direto para a fila.

Os testes rodam isolados (como `ForwardWhatsAppMessage.spec.ts`). Observação: o `pretest` do `package.json` roda migrations em `NODE_ENV=test`. Para rodar só esse spec, usar `npx jest src/helpers/__tests__/ResolveChatbotMenuReply.spec.ts`.

**Teste manual** (ambiente de dev com uma conexão de teste):

1. Conexão com 2 filas ("Buscar boleto", "Falar com atendente") e "Fila de Transferência" = "Falar com atendente".
2. Encerrar o ticket de um contato; o contato manda "Ta bom" → recebe o menu 1×.
3. Manda "Obg" → **nenhum menu**; o ticket aparece em Pendentes na fila "Falar com atendente"; a saudação da fila é enviada, se houver.
4. Manda "Agr...pra ajudar" → nada é enviado.
5. Mandar 3 mensagens seguidas bem rápido depois do menu → a saudação da fila sai **uma vez só**.
6. `#` → o menu volta; "1" → fila "Buscar boleto".
7. Sem "Fila de Transferência" → o menu sai até `maxUseBotQueues` (3) vezes e depois para.
8. Repetir com um contato em modo LID.

## 5. Arquivos afetados (resumo)

| Arquivo | Tipo |
|---|---|
| `backend/src/helpers/ResolveChatbotMenuReply.ts` (ou em `services/WbotServices/`) | **novo** |
| `backend/src/helpers/__tests__/ResolveChatbotMenuReply.spec.ts` | **novo** |
| `backend/src/services/WbotServices/wbotMessageListener.ts` | `verifyQueue` (extrair `enterQueue`, fallback, contador, corrigir o intervalo, limpar `botText`), regra de conversa recente (D4), `#` zera o contador |
| `backend/src/services/TicketServices/FindOrCreateTicketService.ts` | zerar `amountUsedBotQueues` ao criar ou reabrir |
| `backend/src/services/TicketServices/UpdateTicketService.ts` | zerar o contador ao encerrar |
| `backend/src/models/Whatsapp.ts` | tipo de `timeUseBotQueues`; nova coluna `skipMenuAfterHumanHours` |
| **novo** `backend/src/database/migrations/20260930000000-add-skipMenuAfterHumanHours-to-whatsapps.ts` | coluna da janela da D4 (padrão 24) |
| `backend/src/controllers/WhatsAppController.ts`, `services/WhatsappService/{Create,Update}WhatsAppService.ts` | aceitar e persistir `skipMenuAfterHumanHours` |
| `frontend/src/components/WhatsAppModal/index.js` | campo "Pular menu se houve atendimento nas últimas X horas" e texto da seção de redirecionamento |
| `frontend/src/translate/languages/{pt,es}.js` (e `en.js`, que ainda não tem a chave) | `queueRedirectionDesc` |

**1 migration (coluna nova com padrão 24). Nenhuma mudança de API além do campo novo no cadastro da conexão. Nenhuma configuração obrigatória em produção.** `handleChartbot` e os submenus (§4.4) ficam fora deste PR.

## 6. Configuração de produção: verificada (ver §1.1)

- `chatBotType = text` na empresa 2, então o menu raiz passa por `botText`, que é o caminho corrigido.
- **`transferQueueId = 1` ("Falar com atendente") já está configurado** na única conexão. O fallback funciona assim que o deploy sair, sem mexer em configuração.
- "Buscar boleto" é uma integração **typebot** sem `QueueOptions`. Não há submenu em produção, então o §4.4 **não afeta o caso do chamado** (ver D5). O fluxo do typebot mantém a fila no ticket (`typebotListener.ts`), então não volta ao menu raiz.
- A fila "Falar com atendente" **não tem saudação**. Com o fallback, o cliente é redirecionado **sem receber nenhuma mensagem** (ver D6).
- `timeUseBotQueues = 0`, então corrigir essa regra não muda nada em produção.
- `expiresTicket = 120` é a origem do "meio da conversa" (ver D4).

## 7. Decisões em aberto

| # | Decisão | Recomendação |
|---|---|---|
| D1 | Reaproveitar `transferQueueId` ou criar um campo novo `Whatsapps.fallbackQueueId` (migration, model, services, controller, modal) | **Reaproveitar.** A semântica da seção existente já é essa, e é menos código. Um campo novo só se quiserem uma fila de "resposta inválida" diferente da fila de "transferência por tempo". |
| D2 | Quantas respostas inválidas antes de redirecionar | **1** (a 1ª resposta inválida depois do menu), como a cliente pediu. Dá para parametrizar depois. |
| D3 | Sem fila de redirecionamento: manter "Opção inválida"? | Não. Enviar o menu até `maxUseBotQueues` e depois silenciar. A mensagem "Opção inválida" nunca funcionou de fato (§2.2-3). |
| D4 | Evitar até o **1º menu** quando o cliente está respondendo a uma conversa humana recente. Em produção, o `expiresTicket = 120` encerra o ticket 2 h depois da resposta do atendente; o próximo "ok" do cliente reabre o ticket e dispara o menu. No caso do print, isso aconteceu 3 vezes em 2 dias. | **Incluir (§4.5).** Decidido: janela de **24 h**, configurável por conexão na tela (§4.6/§4.7). Mexe só no `verifyQueue`: não altera o `FindOrCreateTicketService` nem o auto-close. Depois do fix principal ainda sobraria 1 menu "no meio da conversa" a cada reabertura, que é literalmente a reclamação. |
| D5 | Submenus (§4.4) no mesmo PR? | **Não.** Produção não tem `QueueOptions`. Fica registrado como melhoria futura, para reduzir o risco do PR. |
| D6 | O redirecionamento é silencioso porque a fila "Falar com atendente" não tem saudação | **Configuração, não código:** sugerir à TOP VEÍCULOS cadastrar uma saudação na fila (ex.: "Certo! Um de nossos atendentes vai continuar seu atendimento em instantes."). O `enterQueue` já envia essa saudação. Sem ela, o cliente só não recebe mais o menu, o que também atende o pedido. |

## 8. Riscos

- **Clientes que respondem o menu com texto** ("quero o boleto") passam a ir para o atendente em vez de receber o menu de novo. É o comportamento pedido, mas vale avisar a TOP VEÍCULOS.
- **Outras empresas ou conexões:** em produção existe uma única conexão (a da TOP VEÍCULOS), com `timeUseBotQueues = 0`. Não há impacto colateral hoje.
- **D4 e mensagens automáticas:** notificações enviadas pelo sistema principal via `/public/messages/send-by-number`, campanhas e agendamentos também são mensagens `fromMe` sem o prefixo `\u200e`. Um cliente que responde a um lembrete de boleto vai direto para "Falar com atendente", sem menu. Na prática isso é desejável (quem responde a uma cobrança quer falar com alguém), mas o "Buscar boleto" pelo typebot só fica acessível com `#`.
- **`wbotMessageListener.ts` tem cerca de 2.300 linhas e nenhum teste.** Para reduzir o risco, as mudanças ficam restritas a `verifyQueue`/`handleChartbot`, a decisão fica no helper testado e a extração de `enterQueue` é mecânica.

## 9. Implementado (2026-09-30): diferenças em relação ao plano

Implementado no working tree, sem commit. A migration **não foi executada**.

Além do que está nas seções 4.1 a 4.8 (exceto §4.4, que ficou fora), a revisão acrescentou:

| Mudança | Motivo |
|---|---|
| Helper e spec em `services/WbotServices/` (não em `helpers/`) | fica dentro da cobertura do jest |
| **Tolerância de 3 s depois do menu** (`MENU_REPLY_GRACE_MS`): mensagem enviada antes do menu, ou até 3 s depois dele, não conta como resposta inválida (o bot fica em silêncio) | o cliente costuma mandar "Oi" e "Bom dia" em sequência; a segunda mensagem ia para o atendente antes de o cliente ver o menu |
| Opção aceita em outros formatos: `[1]`, `*1*`, `(1)`, `1)`, `1️⃣`, `１` | formas comuns de digitar a opção caíam como inválidas |
| `#` passa a encerrar também a integração/typebot/prompt do ticket | `#` dentro do typebot deixava o ticket preso: o menu aparecia e as respostas eram ignoradas |
| O claim de fila/menu não mexe em ticket com atendente ou encerrado | condição de corrida com o atendente aceitando o ticket |
| Fila de transferência fora do expediente: o aviso é enviado uma vez e o ticket fica na fila | evitava reenviar o aviso a cada mensagem |
| A regra das 24 h ignora os avisos "*Mensagem automática*" (transferência, chamada recusada) | não são mensagens de atendente |
| `skipMenuAfterHumanHours` limitado a 87.600 h | valor enorme fazia a consulta falhar |
| `wbotClosedTickets.ts`: chave `amountUseBotQueues` corrigida para `amountUsedBotQueues` | erro de digitação antigo; o encerramento automático não zerava o contador |
| Modal: "Transferir após x" vazio é enviado como `null` | `""` numa coluna inteira era rejeitado pelo banco |

Conhecido e não alterado:

- A opção válida tem prioridade sobre a regra das 24 h: se o atendente pergunta algo e o cliente responde só "1", o typebot "Buscar boleto" começa.
- Mensagens do typebot, campanhas, agendamentos e da API pública contam como "atendimento humano" na regra das 24 h (em produção: 1 caso em 204 nos últimos 30 dias).
- `es.js` tem um erro antigo de aninhamento: o espanhol cai no português.
- `wbotTransferTicketQueue.ts` (cron de transferência por tempo) grava a fila sem checar se o ticket mudou: corrida rara e antiga com o cliente escolhendo "1" no mesmo instante.

**Deploy:** rodar `db:migrate` **antes** de subir o backend novo. O model passa a ler a coluna nova em toda consulta de conexão; sem a migration, essas consultas falham.
