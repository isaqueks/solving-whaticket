# Refatoração — registro das alterações

> Data: 23/07/2026. Complementa `docs/ANALISE-CODIGO.md` (diagnóstico completo).
> Dois rounds: **Round 1** (segurança + bugs + código morto + duplicação) e
> **Round 2** (§ no fim: responsabilidade única, guard clauses, remoção de
> cobrança e OpenAI).
> **Verificação após cada round:** `tsc --noEmit` limpo no backend e
> `react-scripts build` do frontend concluído com sucesso.
> Saldo acumulado dos dois rounds: **158 arquivos, ~490 linhas adicionadas,
> ~11.700 removidas.**
>
> Princípio seguido: comportamento preservado em tudo que está em produção;
> mudanças de comportamento só onde o comportamento atual era um bug ou a
> funcionalidade foi declarada sem uso pelo dono (cobrança/OpenAI).

---

## 1. Segurança (backend)

### SQL Injection eliminado (parametrização com `replacements`)
- `services/ResetPasswordService/ResetPassword.ts` — `email`/`token`/hash agora
  são bind params nas 3 queries do fluxo de reset (antes: interpolação direta de
  parâmetros de URL pública).
- `services/ForgotPassWordServices/SendMail.ts` — `email` e token parametrizados.
- `services/ReportService/TicketsAttendance.ts` e `TicketsDayService.ts` —
  `companyId` e datas parametrizados (formatos de data preservados).

### Rotas endurecidas
- `GET /dashboard/ticketsUsers` e `/ticketsDay`: agora exigem `isAuth`; o
  `companyId` vem de `req.user`, não mais da query string. O frontend já chama
  via cliente autenticado (cookie), então nada muda para o usuário.
- `GET /fixTickets`: agora exige `isAuth` e responde `{ started: true }` (antes
  ficava pendurado até timeout, sem auth).
- `POST /webhook/contacts/sync`: novo middleware `contactSyncAuth` —
  **condicional**: se `CONTACT_SYNC_TOKEN` estiver definido no `.env`, exige o
  token (header `x-webhook-token` ou campo `token` no body/query); se não
  estiver, loga um aviso e permite (comportamento atual preservado para não
  quebrar a integração externa). **Ação sua:** definir o token nos dois lados
  quando puder.
- `POST /api/messages/send`: `middleware/tokenAuth.ts` deixou de ser um stub
  vazio — agora valida `Authorization: Bearer <token>` contra o token da
  conexão WhatsApp e injeta o `whatsappId` (padrão do Whaticket upstream). Isso
  também **conserta** o endpoint, que estava quebrado (lia `req.params.whatsappId`
  inexistente e falhava em toda chamada).
- `POST /companies/cadastro`: **mantido** — a página de Signup do frontend o usa
  via cliente não autenticado. Porém a senha padrão hardcoded `"mudar123"` do
  `CreateCompanyService` virou senha aleatória (`randomBytes(16)`) quando
  nenhuma é fornecida.
- `/plans/all` e `/invoices/list`: ganharam `isAuth`. `/plans/list` ficou
  público de propósito (a página de Signup consome o preço dos planos sem login).
- `middleware/isSuper.ts`: null-check no usuário (antes: crash 500 por
  destructure de null se o usuário tivesse sido deletado).
- `backend/.env.example`: URL e token reais da integração `WPP_RECEIVE_MESSAGE`
  substituídos por placeholders; adicionado `CONTACT_SYNC_TOKEN`.
  **Ação sua: rotacionar o token `talkchat-api` no receptor** (ficou no
  histórico do git).

## 2. Bugs corrigidos (comportamento que estava errado)

| Onde | O que estava errado | Correção |
|---|---|---|
| `wbotMessageListener.ts` (4×) | `QueueOption.length` (aridade do construtor do model, constante) na regra "botões vs texto" do chatbot | `queueOptions.length` (o array real de opções) |
| `wbotClosedTickets.ts` (2×) | `amountUseBotQueues` (typo) silenciosamente ignorado pelo Sequelize — contador do bot nunca resetava no fechamento automático | `amountUsedBotQueues`; os 3 ramos idênticos do `closeTicket` viraram um só |
| `libs/wbot.ts` | Promise do `initWASocket` podia ficar pendente para sempre (erros async não chegavam ao `reject`; caminhos QR-esgotado/fechou-antes-de-abrir nunca resolviam) | IIFE com `.catch(reject)`; `reject` nos caminhos terminais (tardio pós-resolve é inócuo) |
| `libs/wbot.ts` | Contador de QR misto (lia o `Map` persistente, gravava a partir de local zerada) — corte de 3 tentativas derrotável | Contador só no `Map`, incremento atômico, **limpo ao conectar** (sem isso, contagens antigas derrubariam sessões válidas) |
| `libs/wbot.ts` + `StartWhatsAppSession.ts` | Estados DISCONNECTED/OPENING emitidos no evento `"whatsappSession"` que o frontend não escuta | `company-${id}-whatsappSession` |
| `FilesController.ts` (3×) | Evento `company${id}-file` sem hífen — frontend nunca recebia | `company-${id}-file` |
| `AnnouncementController.ts` + frontend | `store`/`update` emitiam evento global, `remove` escopado, frontend só escutava o global (remoções nunca refletiam) | Backend emite escopado em tudo; listeners do frontend (`Annoucements`, `AnnouncementsPopover`) atualizados juntos |
| `wbotTransferTicketQueue.ts` | Emitia para salas genéricas (`"pending"`, `"notification"`) que o frontend não usa | Salas `company-*`/`queue-*` (padrão do `UpdateTicketService`) |
| `wbotMessageListener.ts` (`messages.upsert`) | `forEach(async)` processava o lote todo em paralelo: ordem não preservada + **tickets duplicados** para contato novo com 2 mensagens rápidas | `for...of` sequencial |
| `GetCachedPFP.ts` | `promiseMap.delete` fora do `finally` (commit "fix"): falha do Redis congelava a foto de perfil em memória até reiniciar | `try/finally` em volta do `cacheLayer.set` |
| `helpers/Debounce.ts` | Timers indexados por id numérico cru: `contact.id` (sync de grupo) podia cancelar timer de um `ticket.id` alheio | Classe `DebounceManager` com chaves `number\|string`; sync de grupo usa `group-${id}` (os timers por ticket continuam se cancelando entre si, como antes — intencional) |
| `queues.ts` | Job repetitivo `VerifyQueueStatus` (cron 20 s) **sem processador** acumulando no Redis | `add` e a fila `queueMonitor` removidos |
| `queues.ts` | `Object.keys(options)` com `options` possivelmente `null` (campanha falhava silenciosamente) | Guard `options &&` |
| `CreateCompanyService.ts` | Dois `findOrCreate` com `where`/`defaults` trocados: settings `CheckMsgIsGroup` e `call` nunca semeadas (criava chaves `"enabled"` e `""`) | Chaves corrigidas |
| `UpdateDeletedUserOpenTicketsStatus` + `DeleteUserService` | `forEach(async)` não aguardado + chamada sem `await`: usuário destruído antes dos tickets serem liberados | `for...of` + `await` antes do `destroy()` |
| `handleMessageIntegration` | `throw` dentro do callback do `request` = exceção não capturável (podia derrubar o processo) | `logger.error` |
| TTS OpenAI (2×) | `.then()` sem `.catch` = unhandled rejection | `.catch` com log |
| `MessageController.send` | `Object.keys(err).length === 0` mascarava `Error` reais | `instanceof AppError` + log |
| `SubscriptionController` | `createWebhook` engolia erro sem responder (request pendurava); `index` sem `await` serializava Promise | respondem corretamente |
| `GetTicketByNumberController` | Cache em memória sem TTL nem limite (crescimento infinito + resultado obsoleto eterno) | TTL 5 min + máx. 5000 entradas |
| `ForgotController` | Ramo de falha (404) devolvia a mensagem de **sucesso** | Mensagem corrigida (status já estavam certos) |

## 3. Código morto removido

**Backend** (arquivos): `QuickMessageController_OLD.ts`, `ResetPassword.ts.bak`,
`errors/toastError.js`, `helpers/CheckContactSomeTicket.ts`, `services/fixWPP.ts`,
`utils/global.ts` (o `map_msg` write-only), spec de teste vazio.
**No `wbotMessageListener.ts`** (~250 linhas): `isNumeric`, `sleep`/`timeout`,
`sendMessageImage`, `sendMessageLink`, `makeid`, `getQuotedMessage` (quebrado),
`getMeSocket`/`getSenderMessage`, `Push`, interfaces `IMe`/`IMessage`, handler
comentado, guardas impossíveis, condição morta `'concluido'`, imports órfãos.
**Outros:** export `getContact` sem rota e bloco `vNumber` morto
(`ContactController`), fetch de Setting descartado no `FindOrCreateTicketService`
(**era 1 query de banco por mensagem recebida, jogada fora**), rota duplicada
`messageRoutes`, blocos comentados grandes (`InvoicesController`, `isAuth`,
`ContactUpdateWebhookController`), dumps de debug `contatos_antes/depois.txt` do
`ImportContactsService`, branch vazio do `wbotMonitor`, ~25 `console.log` de
debug (trocados por `logger` ou removidos).

**Frontend** (~4.000 linhas, build validado): toda a cadeia "não-Custom" de
tickets (`MessageInput`, `TicketsList`, `TicketListItem`, `TicketsManager`,
`TicketActionButtons`, `TransferTicketModal`, `pages/Tickets`, `pages/Settings`,
`Dashboard/index_old.js`) + `ContactListTable`, `ContactNotesDialog`,
`CurrencyInput`, `QuickMessagesTable`, `SubscriptionStepper`,
`UserLanguageSelector`, `index_Antigo.js`, `QueueSelect/index copy.js` e
`index_erro.js`, `TagModal/index.js_Backup`, `useQuickMessages_OLD`,
`useContacts`, `useContactListItems`, `useInvoices`, `pages/Companies`,
`Schedules.bkp`, `.DS_Store`, `services/socket.js` (stub que só lançava erro).
Cada exclusão re-verificada por grep de imports antes de apagar.

## 4. Refatorações de estrutura (comportamento preservado)

- **`wbotMessageListener.ts`: 2.255 → ~1.950 linhas.**
  - Lógica de "fora do expediente" triplicada (~120 linhas × 3) extraída para
    `isOutsideQueueSchedule(queue)` — os 3 pontos de uso mantêm seus envios/
    debounces próprios.
  - Bloco de reabertura de ticket fechado duplicado extraído para
    `reopenTicketIfClosed(msg, ticket)`.
  - `handleOpenAi`: ramos texto/áudio quase idênticos consolidados em
    `buildChatHistory()` + `replyWithAiResponse()` (~70 linhas de duplicação a
    menos).
  - `downloadMedia`: retorno `null` quando o mimetype é indeterminável (antes:
    `TypeError`); falha de download do buffer segue registrando a mensagem
    (comportamento preservado), mas sem tentar gravar arquivo `undefined`.
- **`helpers/Debounce.ts`** reescrito como classe `DebounceManager` (POO onde há
  estado coeso), API `debounce()` preservada.
- **`ImportContactsService`**: loop sequencial (`for...of`) em vez de fan-out
  não aguardado.
- **Renomeações de typo** (imports atualizados, `tsc` verde):
  `DashbardController` → `DashboardController`, `DashbardDataService` →
  `DashboardDataService`, classe `GetTickerByNumberController` →
  `GetTicketByNumberController`, alias `VerssionController` → `VersionController`.
  `Mustache.ts` ganhou a chave `greeting` **ao lado** da antiga `gretting`
  (templates existentes continuam funcionando).
- **`app.ts`**: removidos o `require("body-parser")` duplicado e o
  `express.json()` redundante (limite efetivo de 10 MB preservado).
- **`config/database.ts`**: fallback de dialeto `mysql` → `postgres` (o código
  é Postgres-only; produção já define `DB_DIALECT`).

## 5. Frontend — correções pontuais

- `CheckoutSuccess`: listener de socket sem cleanup (leak real) — adicionado
  `disconnect()` no retorno do `useEffect`.
- `useAuth`: `setInterval` do guard multi-abas agora tem cleanup.
- `SocketContext`: `console.log(1)` removido; logger `onAny` (todo evento!) só
  fora de produção.
- URL de login `solving.com.br` extraída para `REACT_APP_LOGIN_URL` (com o
  mesmo default — nada muda sem configurar).
- `TicketListItemCustom`: imports não usados e props inválidas (`dense`/`button`/
  `selected` em `<Paper>`, `loading` em `<MenuItem>`) removidos.

## 6. O que NÃO foi alterado (decisões conscientes)

- **Integração "last contact"** (`NotifyWppReceiveMessage`, export CSV,
  webhook de contatos): comportamento 100% preservado — só ganhou o token
  opcional e logs melhores.
- `messages.update` chamando `readMessages` a cada ack: suspeito, mas remover
  mudaria confirmações de leitura visíveis — **decisão sua** (ver análise §6).
- Senha na URL do reset de senha; payload JWT `usarname`; fallbacks de JWT;
  consolidação dos 6 `mediaUpload` duplicados; divisão do listener em módulos;
  maquinário multi-tenant — motivos em `ANALISE-CODIGO.md` §6.

---

# Round 2 — Responsabilidade única, padronização e remoção de cobrança/OpenAI

## R2.1 Remoção completa: cobrança/pagamento (não usado)

**Backend removido:** `SubscriptionController` (Gerencianet PIX),
`InvoicesController`, rotas `subScriptionRoutes`/`invoicesRoutes`,
`services/InvoicesService/` (4 arquivos), models `Invoices` e `Subscriptions`
(retirados do registry em `database/index.ts`), `config/Gn.ts`, dependência
`gn-api-sdk-typescript`.
**Frontend removido:** `components/CheckoutPage/` (árvore inteira),
`pages/Financeiro/`, `pages/Subscription/`, `SubscriptionModal`, rota
`/subscription`, item de menu Financeiro, e o aviso "Ativo até {data}" do
cabeçalho (virou saudação simples).
**Decisões:** *Planos foram mantidos* — controlam gating de funcionalidades
(menus/páginas), não cobrança. O fluxo `BUSCAR_BOLETO` também fica — é a **sua**
integração de inadimplência, não billing do SaaS. **Migrations e tabelas do
banco ficam** (histórico preservado; tabelas órfãs são inofensivas).
`backend/certs/` só tinha um placeholder vazio (nunca houve certificado
Gerencianet instalado).

## R2.2 Remoção completa: OpenAI (não usado)

**Backend:** `handleOpenAi` + sessões OpenAI + toda a cadeia de TTS
(Azure Speech + conversão ffmpeg) no listener; os 4 pontos de disparo
(conexão, fila ×2, `verifyQueue`); `PromptController`, `promptRouter`,
`services/PromptServices/`, model `Prompt` (associações removidas de
`Queue`/`Ticket`/`Whatsapp` — **colunas `promptId` ficam** no banco e nos
models como colunas simples); dependências `openai` e
`microsoft-cognitiveservices-speech-sdk` (o `fluent-ffmpeg` fica — usado pelo
envio de mídia).
**Frontend:** `pages/Prompts/`, `PromptModal`, rota `/prompts`, item de menu
(e seu gate `useOpenAi`), selects de Prompt nos modais de Fila e de Conexão
(payloads ajustados; backend continua aceitando/ignorando `promptId`).
**Typebot não foi tocado** (integração separada, em uso).

## R2.3 Responsabilidade única — `wbotMessageListener.ts` (2.017 → 438 linhas)

O arquivo-deus virou um orquestrador + 8 módulos coesos em `WbotServices/`:

| Módulo | Responsabilidade |
|---|---|
| `types.ts` | Tipo `Session` compartilhado |
| `wbotMessageParser.ts` | Parsing puro de mensagens (tipo, corpo, vcard, quoted, validação, filtro) |
| `wbotMessagePersistence.ts` | Download de mídia, gravação de mensagens, reabertura de ticket |
| `wbotContactVerifier.ts` | Criação/atualização de contato e grupo |
| `wbotChatbotFlow.ts` | Fluxo de filas/chatbot (`verifyQueue`, `handleChartbot`, horários, integrações n8n/webhook/typebot) |
| `wbotRating.ts` | Avaliação NPS |
| `wbotCampaignHooks.ts` | Ganchos de campanha |
| `wbotMessageAck.ts` | Confirmações (ack) |
| `wbotMessageListener.ts` | Orquestrador (`handleMessage` + listener) e re-exports da API histórica |

Dependências acíclicas (parser ← persistence ← fluxos ← orquestrador).
Importadores externos atualizados (`typebotListener`, `UpdateTicketService`,
`wbotClosedTickets`); demais símbolos re-exportados para compatibilidade.

## R2.4 Responsabilidade única — `queues.ts` (~850 → 14 linhas)

Virou um barrel que re-exporta os mesmos 8 símbolos públicos de `src/queues/`:
`connection.ts` (Redis + instâncias Bull), `lib.ts` (helpers puros),
`campaignJobs.ts`, `scheduleJobs.ts`, `messageJobs.ts`, `ticketJobs.ts`
(inclui o bootstrap de crons da instância principal, preservado como
side-effect import), `userMonitorJobs.ts`, `startQueueProcess.ts`.
Zero mudança de comportamento (mesmos crons, nomes de jobs e caches).
Correção necessária no caminho `public/` (os módulos compilam um nível mais
fundo em `dist/queues/`). Mortos removidos: require de `nodemailer` nunca
usado, `sleep` órfão, import `Plan`.

## R2.5 Padronização (guard clauses / early returns)

Aplicada mecanicamente em todo código movido ou tocado nos dois rounds
(`if (!x) return;` em vez de corpo inteiro dentro de `if (x)`; `if (a) return x;
return y;` em vez de if/else) — ex.: `GetDefaultWhatsApp`, `Mustache`
(`periodGreeting`), hooks de campanha, `handleProcessCampaign`,
`handleMessageIntegration`. Cadeias if/else profundas do chatbot foram movidas
verbatim (reestruturar lógica de fluxo sem testes seria risco desnecessário).

---

## Checklist pós-deploy (recomendado)

1. Rotacionar o token `talkchat-api` no sistema receptor e atualizar o `.env`.
2. Definir `CONTACT_SYNC_TOKEN` no backend **e** no chamador do webhook.
3. Rodar `npm install` no backend (dependências `openai`,
   `microsoft-cognitiveservices-speech-sdk` e `gn-api-sdk-typescript` saíram do
   `package.json`).
4. Smoke test: conectar/desconectar o WhatsApp (QR), enviar/receber mensagem,
   chatbot de filas, mensagem fora de expediente, fechar ticket automático,
   campanhas, agendamentos, anúncios (criar/remover), upload em Arquivos,
   reset de senha, modais de Fila e Conexão (perderam o campo Prompt).
5. Conferir se o `.env` de produção define `DB_DIALECT` (agora o default é
   `postgres`, igual ao que produção usa — mas confirme).
6. Se um dia quiser dropar as tabelas órfãs (`Invoices`, `Subscriptions`,
   `Prompts`), criar uma migration própria — nada no código as referencia.
