# Análise severa do código — solving-whaticket

> Data: 23/07/2026. Análise conduzida com 4 auditorias independentes (núcleo WhatsApp,
> backend geral, frontend, código customizado recente), com cada achado verificado
> contra o código real deste fork (não o Whaticket upstream).
>
> Contexto assumido: **uma empresa** (companyId = 1, sem planos de multi-tenant) e
> **uma conexão WhatsApp**. Sistema em produção — as correções aplicadas foram
> conservadoras. O que foi de fato alterado está em `docs/REFATORACAO.md`.

---

## 1. CRÍTICOS — Segurança

### 1.1 SQL Injection em rotas SEM autenticação (4 pontos)
O projeto sabe usar `replacements` parametrizados (ex.: `DashbardDataService.ts`),
mas quatro services interpolavam input do usuário direto na SQL:

| Arquivo | Entrada | Risco |
|---|---|---|
| `services/ResetPasswordService/ResetPassword.ts` | `email`, `token` da URL pública `POST /resetpasswords/:email/:token/:password` | Reset de senha de **qualquer** usuário via injeção no `token` |
| `services/ForgotPassWordServices/SendMail.ts` | `email` da URL pública `POST /forgetpassword/:email` | `' OR '1'='1` gravaria token de reset em **todos** os usuários |
| `services/ReportService/TicketsAttendance.ts` | `companyId`, datas de `req.query` em rota **sem isAuth** | Exfiltração de dados sem login |
| `services/ReportService/TicketsDayService.ts` | idem | idem |

### 1.2 Rotas sem autenticação
- `GET /dashboard/ticketsUsers` e `/dashboard/ticketsDay` — sem `isAuth`, e ainda
  eram a porta de entrada dos SQLi acima.
- `GET /fixTickets` — disparava um job de manutenção full-table sem auth e nunca
  respondia a requisição (hang até timeout).
- `POST /webhook/contacts/sync` — escrita de contatos sem nenhum token (o arquivo
  de rotas importava `isAuth` e `envTokenAuth` mas não aplicava nenhum).
- `POST /companies/cadastro` — criação pública de empresa + usuário **admin** com
  senha padrão hardcoded `"mudar123"` (`CreateCompanyService.ts`).
- `middleware/tokenAuth.ts` — era um **stub vazio** (`return next()`), única
  "proteção" de `POST /api/messages/send` (endpoint que por sorte estava quebrado
  por outro bug — ver 2.6).

### 1.3 Segredos
- `backend/.env.example` (versionado) continha a **URL de produção e o token real**
  da integração `WPP_RECEIVE_MESSAGE` (`talkchat-api`). Esse token está no
  histórico do git — **recomendação: rotacionar o token no sistema receptor**.
- `config/auth.ts` tem fallbacks fracos (`"mysecret"`) para JWT. Impacto reduzido
  porque este fork **não usa JWT local** para autenticar (ver 5.1), mas o ideal é
  definir `JWT_SECRET`/`JWT_REFRESH_SECRET` fortes no `.env`.
- `a.http` (versionado) contém URL interna de produção e um número de telefone
  real. Mantido (arquivo de teste do dono), mas vale considerar remover do repo.

---

## 2. Bugs reais confirmados (funcionalidade)

### 2.1 `wbotMessageListener.ts` — `QueueOption.length` (4 ocorrências)
`QueueOption` é a **classe do model** Sequelize; `.length` é a aridade do
construtor (constante). O autor queria `queueOptions.length` (o array local).
Resultado: a regra "mais de 4 opções → volta para texto" **nunca funcionou**.

### 2.2 `wbotClosedTickets.ts` — typo silencioso `amountUseBotQueues`
O campo real é `amountUsedBotQueues`. O Sequelize ignora chave desconhecida no
`update()`, então o reset do contador do bot no fechamento automático **nunca
acontecia** — sem erro nenhum.

### 2.3 Eventos de socket com nome errado (UI nunca recebia)
- `libs/wbot.ts` (estado DISCONNECTED após 3 QR) e `StartWhatsAppSession.ts`
  (estado OPENING) emitiam `"whatsappSession"`, mas o frontend só escuta
  `company-${id}-whatsappSession`.
- `FilesController.ts` emitia `company${id}-file` (sem hífen); o frontend escuta
  `company-${id}-file`.
- `AnnouncementController.ts`: `store`/`update` emitiam evento global
  `company-announcement` e `remove` emitia escopado — o frontend só escutava o
  global, então a UI nunca refletia remoções.
- `wbotTransferTicketQueue.ts` emite para salas genéricas (`io.to(status)`) em vez
  das salas `company-*` que o frontend usa.

### 2.4 `initWASocket` (libs/wbot.ts) — promise que podia nunca resolver
`new Promise(async …)` com IIFE fire-and-forget interna: erros async viravam
unhandled rejection (não chegavam ao `reject`), e caminhos como "QR esgotado",
"conexão fechou antes de abrir" e "whatsapp não encontrado" deixavam a promise
**pendente para sempre** — o `await` em `StartWhatsAppSession` pendurava.

### 2.5 Processamento concorrente de mensagens (`messages.upsert`)
`messages.forEach(async …)` não aguarda: um lote de mensagens era processado todo
em paralelo. Consequências: ordem não preservada; para contato novo com duas
mensagens rápidas, **dois tickets podiam ser criados** (corrida no
`FindOrCreateTicketService`); corrida no guard de dedup por id.

### 2.6 `POST /api/messages/send` quebrado
O controller lê `req.params.whatsappId`, mas a rota não tem esse parâmetro —
sempre `undefined` → `findByPk(undefined)` → erro em toda chamada. (Corrigido
implementando o `tokenAuth` real, padrão upstream: valida o token da conexão e
injeta o `whatsappId`.)

### 2.7 Contador de QR code misto (libs/wbot.ts)
Guard lia o `Map` persistente mas gravava a partir de uma variável local zerada a
cada reconexão — o corte de "3 tentativas" era derrotável por reconexões. Na
correção, o contador passou a viver só no `Map`, **com limpeza ao conectar** (sem
a limpeza, contagens antigas acumulariam e derrubariam sessões válidas).

### 2.8 `GetCachedPFP.ts` — leak introduzido no commit "fix" (04b7e7c)
`promiseMap.delete` saiu do `finally` para depois do `cacheLayer.set`. Se o Redis
falhar nesse `set`, a promise resolvida fica no Map **para sempre**: o processo
passa a servir a foto de perfil obsoleta eternamente (nem o TTL de 24h do Redis
salva). Corrigido com `try/finally`.

### 2.9 Corridas e erros engolidos diversos
- `UpdateDeletedUserOpenTicketsStatus`: `forEach(async)` não aguardado + chamada
  sem `await` no `DeleteUserService` → usuário era destruído **antes** dos tickets
  serem atualizados.
- TTS do OpenAI: `convertTextToSpeechAndSaveToFile(...).then(...)` sem `.catch` →
  unhandled rejection.
- `handleMessageIntegration`: `throw` dentro de callback do `request` → exceção
  não capturável pelo try/catch externo (podia derrubar o processo).
- `queues.ts`: `queueMonitor.add("VerifyQueueStatus", …, cron 20s)` **sem
  processador registrado** (o `.process` está comentado e o handler nem existe) —
  jobs acumulando no Redis indefinidamente.
- `CreateCompanyService`: dois `Setting.findOrCreate` com `where`/`defaults`
  trocados — as settings `CheckMsgIsGroup` e `call` nunca eram semeadas
  corretamente (criava chaves `"enabled"` e `""`).
- `Debounce.ts`: timeouts indexados por id numérico puro compartilhado entre
  entidades — um `contact.id` (sync de grupo) podia cancelar o timer de um
  `ticket.id` não relacionado, e vice-versa.

---

## 3. Código morto (verificado com grep antes de remover)

### Backend
- **Arquivos**: `QuickMessageController_OLD.ts`, `ResetPassword.ts.bak`,
  `errors/toastError.js` (arquivo de *frontend* perdido no backend),
  `helpers/CheckContactSomeTicket.ts`, `services/fixWPP.ts` (import morto),
  spec de teste vazio (0 bytes) em `WbotServices/__tests__`.
- **No `wbotMessageListener.ts`** (~200 linhas): `isNumeric`, `sleep`/`timeout`,
  `sendMessageImage`, `sendMessageLink`, `makeid`, `getQuotedMessage` (morto **e**
  quebrado — lançaria TypeError se chamado), `getMeSocket`+`getSenderMessage`,
  `Push`, interface `IMessage`, handler `messages.set` comentado, guardas
  sempre-verdadeiros (`length > -1`, `if (!messages)` impossível), `.map`
  identidade.
- **Outros**: export `getContact` sem rota (`ContactController`), bloco `vNumber`
  computado e nunca usado (`getContactVcard`), fetch de Setting nunca lida
  (`FindOrCreateTicketService` — uma query de banco **por mensagem recebida**,
  jogada fora), rota duplicada `routes.use(messageRoutes)`, import morto
  `QueueOptionController` em `invoicesRoutes`, blocos comentados grandes em
  `InvoicesController`/`isAuth`/`ContactUpdateWebhookController`, global
  `map_msg` write-only, branch vazio e import morto em `wbotMonitor.ts`.

### Frontend (~4.000 linhas mortas)
A cadeia viva de tickets é: `TicketResponsiveContainer → TicketsCustom/TicketsAdvanced
→ TicketsManagerTabs → TicketsListCustom → TicketListItemCustom`. Toda a cadeia
"não-Custom" estava abandonada (e divergida — não servia de backup):

| Morto | Vivo (canônico) |
|---|---|
| `components/MessageInput` (514 L) | `MessageInputCustom` (927 L) |
| `components/TicketsList` | `TicketsListCustom` |
| `components/TicketListItem` | `TicketListItemCustom` |
| `components/TicketsManager` | `TicketsManagerTabs` |
| `components/TicketActionButtons` | `TicketActionButtonsCustom` |
| `components/TransferTicketModal` | `TransferTicketModalCustom` |
| `pages/Tickets` | `pages/TicketsCustom` |
| `pages/Settings` | `pages/SettingsCustom` |
| `pages/Dashboard/index_old.js` | `pages/Dashboard/index.js` |

Mais: `ContactListTable`, `ContactNotesDialog`, `CurrencyInput`,
`QuickMessagesTable`, `SubscriptionStepper`, `UserLanguageSelector`,
`NotificationsPopOver/index_Antigo.js`, `QueueSelect/index copy.js` e
`index_erro.js`, `TagModal/index.js_Backup`, `hooks/useQuickMessages_OLD`,
`hooks/useContacts`, `hooks/useContactListItems`, `hooks/useInvoices`,
`pages/Companies`, `pages/Schedules.bkp`, `pages/.DS_Store`, e
`services/socket.js` (stub cujo `socketConnection` só lança erro — a camada real
é `context/Socket/SocketContext.js`). Detalhe: `TicketsList` importava
`services/socket-io`, módulo que **nem existe** — prova de que estava morto.

---

## 4. Código macarrão / duplicação

### 4.1 `wbotMessageListener.ts` (2.255 linhas)
O arquivo-deus do sistema. Além do código morto:
- Lógica de **fora do horário de atendimento** copiada **3×** (~120 linhas cada):
  em `handleMessage` (2× — empresa e fila) e em `verifyQueue`.
- Bloco de **reabertura de ticket fechado** duplicado em `verifyMediaMessage` e
  `verifyMessage`.
- `handleOpenAi` com os ramos texto/áudio quase idênticos (~130 linhas).
- `handleMessage` (~420 linhas) orquestra tudo: validação, grupo, contato, cache
  de não lidas, ticket, tracking, horários 2×, avaliação, OpenAI 2×, integração
  2×, fila, saudação, chatbot.

### 4.2 Controllers com upload de mídia quintuplicado
`QuickMessage`, `Campaign`, `Schedule`, `Queue`, `QueueOption`, `Announcement` —
cada um com `mediaUpload`/`deleteMedia` quase idênticos e com *drift* entre
cópias (uns `await`am o update, outros não; uns deletam por `mediaName`, outros
por `mediaPath`). Não consolidado nesta rodada (mudaria muitos endpoints de uma
vez); fica como recomendação.

### 4.3 Frontend
- 61 `console.log/debug` espalhados; logger global `socket.onAny` logando **todo**
  evento em produção.
- `useEffect` sem cleanup: listener de socket no `CheckoutSuccess` (leak real) e
  `setInterval` do guard multi-abas no `useAuth`.
- URL `https://solving.com.br/login` hardcoded em 2 pontos (agora configurável
  via `REACT_APP_LOGIN_URL`, mantendo o mesmo default).

---

## 5. Particularidades deste fork (importante saber)

### 5.1 Autenticação NÃO é JWT local
`middleware/isAuth.ts` valida o cookie `user` contra um endpoint SSO externo
(`CHECK_AUTH_ENDPOINT`) e carrega o usuário local por e-mail. O código JWT está
comentado. Consequências: o payload `usarname` (typo) de `CreateTokens.ts` **não
foi renomeado** (sistemas externos podem decodificar o token), e o refresh token
(`/auth/refresh_token`) está desativado de propósito ("Deprecated endpoint").

### 5.2 Integração "last contact" (código recente do dono — preservado intacto)
- `handleMessage` → `NotifyWppReceiveMessage(contact.number)` fire-and-forget
  (`.catch` vazio de propósito, dedup em memória de 5 min, timeout 10s, 3
  tentativas). **Não bloqueia** o fluxo de mensagens — bom design, mantido.
- `scripts/exportLastContactCsv.ts` — batch offline com paginação keyset. Sem
  injeção de CSV (colunas sanitizadas). Atenção: emite uma linha **por ticket**
  (números repetem; o consumidor precisa agregar) e a data depende do driver
  devolver `Date` TZ-corrigido (frágil se o driver mudar — ver doc de refatoração).
- `IntegrationController` lança `Disabled` na primeira linha — **kill switch
  intencional**, não mexido.

### 5.3 Maquinário multi-tenant/SaaS (inventário)
Planos, faturas, assinaturas (Gerencianet PIX), gestão de empresas, anúncios,
salas de socket por empresa, loops `Company.findAll()` nas filas.

> **Atualização (round 2):** por decisão do dono, **cobrança (faturas,
> assinaturas, checkout, Gerencianet) e OpenAI foram removidos por completo** —
> ver `REFATORACAO.md` §Round 2. **Planos foram mantidos** porque controlam o
> gating de funcionalidades no frontend (menus/páginas), não cobrança. Gestão
> de empresas e salas por empresa também ficam (entrelaçadas no núcleo).

---

## 6. O que foi deliberadamente deixado como está

| Item | Motivo |
|---|---|
| Divisão do `wbotMessageListener.ts` em módulos | Feita apenas parcialmente (código morto + duplicações); mover os clusters grandes (OpenAI, chatbot) é seguro mas gera diff enorme — ver plano em REFATORACAO.md |
| `messages.update` chamando `readMessages` a cada ack | Comportamento suspeito, mas remover muda comportamento visível (confirmações de leitura); precisa de decisão do dono |
| Senha trafegando na URL do reset (`/resetpasswords/:email/:token/:password`) | Mudar exige alterar frontend+backend juntos; SQLi já corrigido; recomendado migrar para body |
| Fallbacks fracos de JWT | Fork não usa JWT local; fail-fast poderia derrubar produção se o `.env` de prod não define as vars |
| Consolidação dos 6 `mediaUpload` duplicados | Mexeria em 6 endpoints de upload de uma vez; recomendado fazer com testes manuais |
| Renomear payload `usarname` | Sistemas externos podem depender |
| i18n `en.js` incompleto (~570 chaves faltando) | Empresa PT-BR; fallback já é pt |
| Caches process-lifetime em `queues.ts` (`userByEmailCache` etc.) | Inofensivo no uso atual; documentado |
| Assets possivelmente órfãos (`bg-login.png` etc.) | Valor baixo, risco de referência indireta |

---

## 7. Recomendações pós-refatoração (ação do dono)

1. **Rotacionar o token** `talkchat-api` no sistema receptor (vazou no git).
2. Definir `CONTACT_SYNC_TOKEN` no `.env` do backend **e** enviar o mesmo token
   no chamador do `/webhook/contacts/sync` (até lá, a rota continua aberta por
   compatibilidade — o backend loga um aviso).
3. Definir `JWT_SECRET`/`JWT_REFRESH_SECRET` fortes no `.env` de produção.
4. Considerar mover a senha do fluxo de reset da URL para o body.
5. Se um dia o export de last-contact parecer errado em ±3h, ver nota de timezone
   em `exportLastContactCsv.ts` (dependência do driver).
