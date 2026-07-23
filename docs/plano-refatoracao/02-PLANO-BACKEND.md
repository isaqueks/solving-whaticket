# Plano de Refatoração — Backend

> Executável fase a fase; cada fase termina com `npx tsc --noEmit` limpo e
> smoke test do domínio tocado. O padrão de código está no doc `04`; a
> arquitetura-alvo e o mapa NestJS no doc `00`. Números do diagnóstico no `01`.
>
> Regra de convivência: o padrão novo (modules/) e o antigo (controllers/ +
> services/) coexistem durante o rollout. Um domínio migra POR INTEIRO
> (controller + services + helpers + rotas) e o legado dele é apagado no mesmo
> passo — nunca ficam duas versões do mesmo domínio.

---

## Fase B0 — Kernel compartilhado (`shared/`) — risco baixo

Criar `src/shared/` com as fundações que todos os módulos consumirão:

**B0.1 `config/AppConfig.ts`** — classe/objeto tipado cobrindo as **33 chaves**
de env hoje lidas ad-hoc em 22 arquivos. Valida presença das obrigatórias no
boot (`DB_*`, `REDIS_URI`, `CHECK_AUTH_ENDPOINT`) e dá default às demais.
Nenhum arquivo fora de `config/` lê `process.env` ao final do rollout.

**B0.2 `shared/realtime/`** — o contrato único de tempo real:
- `rooms.ts` + `events.ts`: TODAS as 5 famílias de sala e TODOS os nomes de
  evento atuais viram funções/constantes — **com os nomes exatamente como são
  hoje** (incluindo os feios), para não quebrar o frontend.
- `RealtimeGateway.ts`: classe com métodos semânticos
  (`emitTicketChanged(companyId, ticket)`, `emitToTicketRoom(...)`) — absorve
  os 87 pontos de `io.to()` gradualmente, conforme cada módulo migra.
- Normalizações de nome (eventos estáticos `"tag"`/`"schedule"`/`"plan"` →
  templated; `-ContactList` → casing padrão; typo `quickemessage`; hífen
  faltando em `schedule`) são **mudanças pareadas com o frontend** (fase F0.2)
  — uma lista explícita, um commit por par, smoke test de cada tela.

**B0.3 `shared/errors/` + política de erro** — mover `AppError`, eliminar os
13 `throw new Error` crus (viram `AppError` com código), e revisar os pontos
de log-and-swallow remanescentes.

**B0.4 `shared/cache/CacheService.ts`** — classe fina sobre o objeto
`cacheLayer` atual (API idêntica, só muda a forma).

**B0.5 Decisões de projeto** (baratas agora, caras depois):
- tsconfig: manter `strict: false` **durante o rollout**, mas com a régua de
  tipagem por módulo (abaixo) e a fase B7 fechando o ciclo com as flags do
  compilador. Regra imediata: **proibido `any` novo**; os 104 existentes só
  diminuem, e o que sobrar fica confinado nos repositories (typings fracos do
  Sequelize v5), com comentário justificando cada um.
- Aliases de path (`@shared/`, `@modules/`) — opcional; se adotado, é aqui.
- Sentry: ou religa os handlers de request/error no `app.ts`, ou remove a
  dependência — estado atual (init sem handlers) é meio-morto.

**Verificação B0:** tsc + boot local + uma mensagem WhatsApp de ponta a ponta.

---

## Fase B1 — Módulo-piloto: Tags — risco baixo

Menor domínio real com todas as peças (CRUD + socket + kanban + sync). Vira o
template vivo:

```
modules/tags/
├── TagsController.ts   # classe; métodos index/store/show/update/remove/kanban/sync
├── TagsService.ts      # classe; absorve os 8 arquivos de TagServices/
├── TagsRepository.ts   # classe; único lugar tocando models Tag/TicketTag
├── tags.routes.ts
├── dtos/ (CreateTagDto, UpdateTagDto, ListTagsFilters…)
└── models/Tag.ts, TicketTag.ts (movidos)
```

Além da forma, o piloto conserta o que o inventário achou no domínio:
validação ausente (entra Yup no boundary do controller), permissão inconsistente
(`update` checava admin, `remove` não), evento socket estático `"tag"` (par com
frontend), `KanbanListService` retornando `{ lista: tags }` em PT (padroniza
payload — mudança pareada com a tela Kanban).

**Saída da B1:** template documentado (linkado no doc 04) + checklist de
migração de módulo (abaixo) validado na prática.

### Checklist "Definition of Done" de cada módulo (vale para B1→B6)
1. Controller classe, fino (sem model, sem `io`, sem negócio).
2. Service classe com deps no construtor; use-cases antigos absorvidos.
3. Repository único ponto de acesso aos models do domínio.
4. DTOs de entrada tipados; validação Yup no boundary.
4b. **Tipagem**: zero `any` fora do repository; zero `@ts-ignore`; o módulo
   compila sozinho com `noImplicitAny` (verificado no passo, mesmo com a flag
   global ainda desligada).
5. Zero duplicação interna; helpers do domínio absorvidos.
6. Realtime só via `RealtimeGateway`.
7. Rotas apontando para o módulo; pasta legada do domínio **apagada**.
8. Nomenclatura/idioma conforme doc 04.
9. `tsc` limpo + smoke test das telas do domínio.

---

## Fase B2 — CRUDs simples — risco baixo (volume)

Mesma receita da B1, em ordem: **QuickMessages** (7 arquivos), **TicketNotes**
(7), **Schedules** (5), **Settings** (3 + `CheckSettings` helper), **Help** (7),
**Announcements** (7), **Users** (7 + `SerializeUser`), **Auth**
(`SessionController` + `CreateTokens` + `SendRefreshToken` + middleware
`isAuth`/`tokenAuth`/`envTokenAuth`/`contactSyncAuth` → `modules/auth/` e
`shared/http/middleware`), **TicketTags** (lógica inline do controller ganha
service), **Version**, **ForgotPassword** (funde as 2 pastas
`ForgotPassWordServices` + `ResetPasswordService` num módulo só).

Ganhos de duplicação nesta fase: **`shared/storage/MediaStorageService.ts`**
nasce aqui (QuickMessages é um dos 6 donos de `mediaUpload`/`deleteMedia`
copiados) e os demais controllers passam a usá-lo conforme migram.

---

## Fase B3 — Domínios médios — risco médio

- **Contacts** (9 services + `getContactJid` + `getOnWhatsappNumber` +
  `getContactMetadata.ts` da raiz + import de contatos + **webhook de sync
  (código do dono — comportamento intocável, só muda a forma)**).
- **ContactLists + ContactListItems** (15 arquivos, praticamente o mesmo CRUD
  2×) — avaliar um `ContactListsService` único com dois repositories.
- **Queues (setores) + QueueOptions** (10 arquivos).
- **Whatsapp (CRUD da conexão)** (`WhatsappService/` 6 + `GetDefaultWhatsApp*`
  helpers) — sem tocar na sessão wbot ainda.
- **Files** (7 + alinhar nome: módulo `files`, model `Files` → repositório
  esconde o plural), **Chat interno** (10), **GroupParticipants** (2),
  **Reports/Dashboard** (`ReportService/` renomeado para o domínio real),
  **Companies/Plans** (superfície SaaS mantida; padroniza sem investir além do
  CRUD).

## Fase B4 — Núcleo: Messages + Tickets — risco alto

O maior valor e o maior cuidado. Absorções:
- `modules/tickets/`: 9 `TicketServices/` + helpers `CheckContactOpenTickets`,
  `GetTicketWbot`, `SetTicketMessagesAsRead`, `UpdateDeletedUserOpenTicketsStatus`
  + `fixTicket.ts` (vira método administrativo `TicketsMaintenanceService` ou
  some — decisão na hora) + os acessos diretos a `Ticket` espalhados (20
  arquivos → `TicketsRepository`).
- `modules/messages/`: `MessageServices/` + `GetWbotMessage` +
  `SerializeWbotMsgId` + partes de mídia do `MessageController` (que hoje é o
  controller mais gordo em lógica).
- `ListTicketsService` (249 linhas de query) e `ListTicketsServiceKanban`
  (212, quase-cópia) → um `TicketsQueryBuilder` no repository, parametrizado —
  caso clássico de desduplicação com cuidado (drift entre as cópias precisa de
  diff linha a linha).
- `libs/socket.ts` para de consultar `Ticket` direto (passa por repository —
  remove a última dependência de camada invertida).

**Smoke test B4 é o pesado**: criar/aceitar/transferir/fechar/reabrir ticket,
enviar/receber texto e mídia, filtros e Kanban, notificações. Inclui o smoke
da integração last-contact.

## Fase B5 — Sessão WhatsApp (wbot) — risco alto

O trabalho do round 2 já separou responsabilidades em módulos; esta fase dá
**forma de classe** e move para `modules/whatsapp-session/`:

- `SessionManager` (classe sobre `libs/wbot.ts`: `sessions[]`, QR retry map e
  `initWASocket` viram estado/métodos da classe — hoje é estado global de
  módulo).
- `MessageListener` (orquestrador: `handleMessage` + wiring dos eventos) e as
  peças `wbot*` viram classes com deps no construtor:
  `MessageParser` (estático/puro), `MessagePersistenceService`,
  `ContactVerifier`, `ChatbotFlowService` (597 linhas — os sub-fluxos
  `botText`/`botButton`/`botList` viram métodos/estratégias privadas),
  `RatingService`, `CampaignHooks`, `AckHandler`, `TypebotSession` (547).
- `authState.ts` → `SessionCredentialsStore` (classe, Redis).
- `wbotTransferTicketQueue.ts` (raiz) entra no módulo como job.
- `NotifyWppReceiveMessage` (integração do dono) vira classe
  `LastContactNotifier` **sem mudar uma vírgula de comportamento** (dedup,
  timeout, retries idênticos).

## Fase B6 — Campaigns + Jobs — risco médio

- `modules/campaigns/`: 9 services + settings + `campaignJobs.ts` (532 linhas,
  ~13 funções de módulo → `CampaignDispatchService` + processors Bull finos).
- `jobs/`: processors viram classes pequenas (`CampaignProcessor`,
  `ScheduleProcessor`, `TicketSweepProcessor`, `LoginStatusProcessor`) — forma
  final que o `@nestjs/bull` espera.
- Crons de bootstrap saem do side-effect import para um `JobScheduler.start()`
  explícito chamado no boot.

## Fase B7 — Endurecimento de tipagem — risco baixo (fecha o ciclo)

Com todos os módulos migrados (cada um já limpo por força do checklist 4b),
ligar as flags em degraus, corrigindo o fallout de cada degrau antes do
próximo:

1. `noImplicitAny: true` — o degrau principal. Como B1–B6 já exigiram módulos
   limpos, o fallout esperado é residual (shared/, scripts/, sobras).
2. `noImplicitThis`, `strictBindCallApply`, `strictFunctionTypes`,
   `alwaysStrict` — baratas depois do degrau 1.
3. `noFallthroughCasesInSwitch`, `noImplicitReturns` — higiene de fluxo.
4. **`strictNullChecks` fica deliberadamente para a migração TypeORM**: com o
   Sequelize v5, ligar agora geraria centenas de falsos-positivos nos models
   (typings da v5 não modelam nullability) — é custo jogado fora, pois as
   entities TypeORM trarão a nullability correta de graça. Registrado como
   primeira tarefa da migração futura.

Meta ao fim da B7: `any` explícito ≤ ~20 (só repositories, justificados),
`@ts-ignore` = 0, e o caminho para `strict: true` reduzido a um item
(`strictNullChecks`) que a troca de ORM resolve.

---

## Estimativa e sequência

| Fase | Tamanho | Pode paralelizar com |
|---|---|---|
| B0 | M | F0 |
| B1 | S | — (é o template; ninguém paraleliza com ela) |
| B2 | L (volume, mas mecânico) | F1 |
| B3 | L | F1/F2 |
| B4 | L (cuidado máximo) | F2 (telas de ticket travam até B4 terminar) |
| B5 | M/L | F3 |
| B6 | M | F3 |
| B7 | S | — (fecho; roda depois de B6) |

Execução sugerida por rodadas de subagentes: 1 fase = 1 rodada; dentro de
B2/B3, um agente por módulo (escopos disjuntos por pasta). B4 e B5 são
trabalho de agente único forte (Fable) com revisão de diff completa.

## Riscos específicos e mitigação

| Risco | Mitigação |
|---|---|
| Mudanças pareadas de evento socket quebrarem uma tela esquecida | Lista fechada de pares no B0.2; grep dos dois lados antes e depois; smoke por tela |
| `ListTickets` unificado mudar um filtro sutil | Diff linha a linha das duas versões + testar cada filtro da UI |
| Sequelize v5 typings forçarem `any` nos repositories | Aceito e confinado (doc 04 §4); anotado para a troca TypeORM |
| Integrações do dono (last-contact, boleto, webhook) | Cobertas por smoke próprio em toda fase que as toca; comportamento congelado |
| Fadiga de rollout (padrão novo abandonado no meio) | Regra de convivência (domínio migra inteiro) garante que nunca há 3º padrão; checklist DoD por módulo |
