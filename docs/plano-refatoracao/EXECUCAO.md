# Log de Execução do Plano

> Atualizado a cada fase concluída. Status: ⏳ em andamento · ✅ concluída · ⬜ pendente

| Fase | Status | Verificação | Notas |
|---|---|---|---|
| B0 — Kernel compartilhado | ✅ | `tsc` limpo | Fable — AppConfig (33 chaves; validate por escopo), shared/realtime (rooms+events+RealtimeGateway com 2 pilotos), shared/errors (12 Error→AppError), shared/cache (cacheLayer vira re-export), Sentry handlers religados; `config/database.ts` e `bootstrap.ts` seguem lendo env (sequelize-cli/dotenv) |
| F0a — Higiene frontend (deps, renames, config) | ✅ | build CRA verde | Opus; 14 deps mortas + Tailwind removidos, `useAuth.js/`→`useAuth/`, VCardPreview unificado, `src/config.js` centraliza env |
| B1 — Piloto Tags | ✅ | `tsc` limpo + módulo limpo sob `noImplicitAny` | Fable — modules/tags completo (controller/service/repository/dtos/rotas/models movidos), legado apagado; pares FE: evento `company-{id}-tag` (pages/Tags, listener antigo em "user" estava quebrado) e payload kanban `{lista}`→`{tags}` (pages/Kanban); fix aprovado: `remove` agora exige admin como `update`; template documentado no doc 04 §12 |
| F0b — Contrato socket FE + camada API + useSocketEvent | ✅ | grep FE (sem build) | Opus; `services/socketEvents.js` (espelho de events.ts; `tag`→`company-${id}-tag` pós-B1), `hooks/useSocketEvent` (cleanup via disconnect, handler em ref), `api/` BaseApi + 13 classes; 13 hooks delegam (useTickets via ticket-cache→ticketsApi). useAuth fora; TagsApi fica p/ B1 |
| B2 — CRUDs, onda A (quick-messages, schedules, settings, help, version) | ✅ | `tsc` limpo + build CRA verde | Opus ×5; MediaStorageService criado; realtime de Schedules estava MORTO (nomes nunca bateram) e foi revivido; typo `quickemessage` corrigido no FE |
| B2 — CRUDs, onda B (announcements, users, ticket-notes, ticket-tags, forgot-password) | ✅ | `tsc` limpo + build CRA verde | Opus ×5; ticket-tags dobrado em modules/tags (2 repos p/ mesmos models seria drift); reset de senha não mascara mais erro como 200; ciclo UsersService↔UpdateTicketService anotado p/ B4 |
| B2 — Auth (session, isAuth, tokens, middleware) | ✅ | `tsc` limpo | Fable; isAuth byte-idêntico (só imports); middleware → shared/http/middleware (33 importers); `usarname` preservado; smoke de login/me/logout pendente (dono) |
| F1 — createEntityReducer + hooks | ✅ | build CRA verde | Opus; 16 migrados, 2 skips justificados (TicketsListCustom/MessagesList); bug real corrigido: Files com case DELETE_TAG morto vs socket DELETE_USER (crash path); 9 Api classes novas |
| B3 onda 1 (contacts, queues+options, whatsapp CRUD, files, reports) | ✅ | `tsc` limpo | Contacts=Fable (webhook congelado; bug de router do /contacts/upload corrigido); ~94 importers repontados; SQL de reports byte-idêntico; flag: files.deleteAll sem companyId |
| B3 onda 2 (contact-lists, chat, group-participants, companies+plans) | ✅ | `tsc` limpo + build CRA verde | Opus ×4; eventos ContactList normalizados (PascalCase→camel, par FE automático via socketEvents); 16 seeds de settings viraram loop data-driven; `ERR_NO_TICKETNOTE_FOUND` copy-paste corrigido em contact-lists |
| F2a/F2b — Componentes-deus (chat + campanha/settings/dashboard) | ✅ | build CRA verde | Fable: MessagesList 1040→156, MessageInputCustom 928→333; Opus: CampaignModal 772→252, Options 720→121 (schema-driven), Dashboard 813→207; libs de gráfico NÃO unificadas (risco visual, F3/futuro) |
| F2c — Componentes-deus restantes (área tickets + QueueModal/QueueOptions/integração) | ✅ | build CRA verde | Opus; 6 alvos: 517→388, 504→243, 490→269, 414→316, 403→339, 401→55; QueueOptionsApi nova; retomado após queda do processo |
| B4 — Núcleo Tickets/Messages | ✅ | `tsc` limpo | Fable; ListTickets unificado (6 divergências documentadas); ciclo Users↔Tickets resolvido; libs/socket sem acesso direto a Ticket; 14 TODO(B5) + 3 TODO(B6) inventariados; smoke pesado pendente (dono) |
| B5 — Sessão WhatsApp (wbot) | ✅ | `tsc` limpo | Fable; modules/whatsapp-session (28 arquivos): SessionManager, pipeline em classes, senders unificados, LastContactNotifier congelado; 26 TODO(B5)→0; libs/wbot deletado sem shim; retomado após queda do processo |
| B6 — Campaigns + Jobs + QueueIntegrations | ✅ | `tsc` limpo | Fable; modules/campaigns + queue-integrations + jobs/ (processors em classes, JobScheduler explícito no boot); pastas legadas controllers/services/models/helpers DELETADAS; TODO(B6) 4→0; noImplicitAny residual: 14 (13 migrations + 1 server.ts) p/ B7 |
| B7 — Endurecimento de tipagem | ✅ | `tsc` limpo (com flags) | Opus; 7 flags ligadas em degraus (noImplicitAny + noImplicitThis/strictBindCallApply/strictFunctionTypes/alwaysStrict + noImplicitReturns/noFallthroughCasesInSwitch); strictNullChecks fica p/ TypeORM. Fallout: 14 (migrations mecânicas + node-cron.d.ts) no degrau 1, 1 variância de callback Baileys (filterMessages→IWebMessageInfo) no degrau 2, 6 returns implícitos no degrau 3; `any` explícito 23→17 (só repos/Baileys/catch/SSO, comentados), @ts-ignore=1 (syncHistory Baileys), entrada morta `plan` removida de events.ts |
| F3 — Padronização final | ✅ | build CRA verde (após fix do orquestrador em ForwardModal) | Opus; console.* 56→3 (guardados), i18n do Settings no catálogo, blocos mortos removidos, socketEvents limpo (`plan` morto), +7 componentes na camada de API |

## Restrições permanentes (todo agente executor)
- Comportamento preservado; integração last-contact e fluxo boleto intocáveis.
- Nomes de evento/sala de socket NÃO mudam sem par frontend listado.
- Sem commits. Verificação: `npx tsc --noEmit` (backend) / build CRA (frontend)
  feita pelo orquestrador ao fim de cada rodada.
- Smoke tests manuais ficam com o dono (não há ambiente local com DB).

## Flags acumuladas para a revisão final (pré-commit)
- `modules/files` — `deleteAll` destrói listas de TODAS as empresas (`where: {}`), bug pré-existente congelado; aplicar escopo `companyId` na revisão.
- `modules/auth` — `logout` preserva null-deref (`user!`) se o usuário local sumir em sessão; avaliar guard na revisão.
- Ciclo de import `UsersService` ↔ `UpdateTicketService` (runtime-safe; resolver na B4).
- Códigos de erro herdados incoerentes (`ERR_NO_TICKETNOTE_FOUND` em quick-messages, `ERR_RATING_*` em files) — cosmético, avaliar se vale par de tradução no FE.
- Smoke tests do dono pendentes: login/me/logout, signup com ENV_TOKEN, telas de cada módulo migrado (lista no doc 02 por fase).
- `shared/realtime/events.ts` ainda tem a entrada estática morta `plan` (frontend já removeu o espelho) — dropar na revisão final.

## Revisão final (pré-commit) — concluída
- 3 revisores (hot path=Fable, CRUD=Opus, frontend=Opus): **0 regressões confirmadas**.
- Fixes aplicados na revisão: `files.deleteAll` escopado por `companyId`; `auth.logout` sem null-deref; captura frágil de singleton no `GroupParticipantsService` trocada por resolução em tempo de chamada (orquestrador).
- Contrato realtime FE↔BE cross-checado evento a evento (tabela no relatório do revisor 3): tudo pareado; 3 realtimes antes mortos religados (tags, schedules, quickmessages).
- Mudanças intencionais documentadas que alteram contrato externo: `/api/messages/send` devolve 404 `ERR_CHECK_NUMBER` p/ número inválido (antes 500 genérico); Yup em `POST /tickets`; Sentry handlers ativos; fail-fast de env no boot.
- Verificação final: `tsc --noEmit` (todas as flags B7) exit 0; build CRA exit 0.
