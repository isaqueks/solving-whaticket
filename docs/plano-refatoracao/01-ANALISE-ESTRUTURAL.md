# Análise Estrutural — o diagnóstico

> Levantamento de 23/07/2026, pós-rounds 1 e 2 (segurança, bugs, código morto,
> decomposições, remoção de billing/OpenAI). Backend: 504 arquivos `.ts`.
> Frontend: 163 arquivos `.js`, ~31,8 mil linhas.
>
> Os rounds anteriores atacaram **defeitos** (bugs, buracos de segurança,
> código morto). O que resta — e este documento mede — é **dívida estrutural**:
> o código funciona, mas não tem forma.

---

## Problema 1 — Não existem camadas

O fluxo `rota → controller → service → model` existe só de aparência; cada
camada faz o trabalho das outras:

- **Controllers fazem negócio**: `MessageController` manipula upload de mídia,
  acessa `Whatsapp.findByPk`/`User.findByPk` direto e enfileira jobs;
  `ContactController` normaliza número, valida com Yup e chama verificação de
  WhatsApp antes do service.
- **17 dos 35 controllers emitem socket diretamente** (o realtime é regra de
  negócio vazando para a camada HTTP).
- **Sem repository**: o model `Ticket` é consultado/alterado em **28 pontos de
  20 arquivos diferentes** (controllers, helpers, libs/socket, jobs, wbot,
  script de export). Trocar Sequelize por TypeORM hoje = tocar o sistema todo.
- **`helpers/` é domínio disfarçado**: dos 19 helpers, ~15 são regra de negócio
  de tickets/whatsapp/auth estacionada fora do módulo dono
  (`CheckContactOpenTickets`, `SetTicketMessagesAsRead`, `GetTicketWbot`,
  `CreateTokens`, `authState`…).

## Problema 2 — Três padrões concorrentes para cada coisa

| Aspecto | Variações convivendo hoje |
|---|---|
| Controller | 34 módulos de funções nomeadas × 1 classe (`GetTicketByNumberController`) |
| Service | 167 arquivos "1 use-case, 1 função default-export" × 26 com named exports × 8 multi-função |
| Nome da pasta de service | 14 `XxxService` × 17 `XxxServices` (+ `ForgotPassWordServices`) |
| Nome do arquivo interno | genérico `CreateService.ts` (Tag, Queue…) × qualificado `CreateTicketService.ts` (Ticket, Company…) |
| Validação | Yup no controller (12) × Yup no service (23) × nas duas camadas (Company, Plan…) × nenhuma (Tag, Queue…) |
| Erros | 195 `AppError` × 13 `throw new Error` cru |
| Tipagem de params | 99 services com `interface` (60 chamadas genericamente de `Request`) × 94 com tipos inline |
| Casing | `Whatsapp` model × `WhatsAppController` × `WhatsappService` |
| Idioma | payloads em PT (`{ mensagem: "…" }`, `{ lista: tags }`) × códigos de erro em EN × identificadores mistos |

No frontend, o mesmo fenômeno: 14 hooks encapsulam API × 63 arquivos chamam
`api.get()` inline; `toastError` (64 arquivos) × `toast.*` direto (48);
Formik (23) × formulários manuais; 2 versões de MUI; 2 libs de gráfico.

## Problema 3 — O contrato realtime é implícito e frágil

- Backend: **87 `io.to(...)` / 93 `.emit(...)`** espalhados por 40 arquivos.
- **5 famílias de sala** (`company-X-mainchannel`, `company-X-status`,
  `queue-X-status/notification`, `user-X`, sala crua do ticket-id) montadas com
  template string à mão em cada ponto.
- **2 estilos de nome de evento**: templated `company-${id}-ticket` × estático
  (`"tag"`, `"schedule"`, `"plan"`, `"ready"`), com casing misto
  (`-contact` × `-ContactList`).
- Frontend espelha o caos: 28 arquivos assinam eventos com strings próprias, com
  **drift real** (`company${id}-schedule` sem hífen, typo `quickemessage` — os
  dois lados têm o MESMO erro, então "funciona").
- Consequência já paga: os 3 bugs de evento nunca-recebido corrigidos no round
  1 só existiram porque não há um lugar único definindo esses nomes.

## Problema 4 — Funções soltas (o anti-padrão dominante)

- 167 services de uma função; 19 helpers soltos; módulos `wbot*` e `queues/*`
  exportando 2–5 funções cada; `fixTicket.ts` e `getContactMetadata.ts` soltos
  na raiz de `services/`.
- Não há **nenhuma classe de serviço** no backend (a única classe de negócio é
  o `DebounceManager` criado no round 1 e o controller-exceção).
- Efeito prático: para entender "o que dá pra fazer com Ticket" é preciso abrir
  9 arquivos de `TicketServices/` + 4 helpers + 3 módulos wbot.

## Problema 5 — Duplicação estrutural remanescente

- Backend: `mediaUpload`/`deleteMedia` copiados em **6 controllers** (com
  drift entre cópias); blocos de emissão socket de ticket repetidos em ~10
  pontos; validações Yup quase idênticas repetidas por domínio.
- Frontend: **18 reducers LOAD/UPDATE/DELETE/RESET colados**; o trio
  reducer+fetch+socket repetido em toda página de listagem; strings PT
  hardcoded (~41) fora do catálogo i18n.

## Problema 6 — Config e tipagem fracas

- `process.env` lido **ad-hoc em 22 arquivos** (33 chaves distintas); `config/`
  cobre só auth/db/redis/upload. Sem validação de presença no boot.
- `tsconfig`: `strict: false`, sem `noImplicitAny`; **104 `: any`** explícitos;
  5 `@ts-ignore`. Sequelize v5 (typings fracos) contribui.
- 32 `console.*` residuais no backend; 19 arquivos no frontend.

## Problema 7 — Nomenclatura sem norma

- Arquivos: 266 PascalCase × 85 camelCase sem critério (routes camel, wbot
  camel, services Pascal, helpers mistos).
- Pastas de domínio sem mapa 1:1 com controller/rota (ex.: `ReportService/` →
  `DashboardController`; `FileServices/` → model `Files`; senha esquecida
  dividida em 2 pastas para 1 controller).
- Frontend: pasta de hook chamada `useAuth.js/` (com extensão no nome);
  `VcardPreview.jsx` (único `.jsx` do projeto) duplicando `VCardPreview/`.

---

## Leitura executiva

A dívida não está mais em "código que quebra" (rounds 1–2 cuidaram disso), e
sim em **ausência de arquitetura**: sem camadas reais, sem contrato de
realtime, sem norma de nomenclatura e com o anti-padrão "1 função solta por
arquivo" multiplicado por ~190. É exatamente o tipo de dívida que a migração
NestJS/TypeORM cobraria com juros — o NestJS **exige** classes, módulos, DI e
DTOs; chegar lá com esta base significaria reescrever na migração.

O plano (docs `02` e `03`) converte essa base em módulos com
Controller/Service/Repository em classes, contrato único de realtime e config
centralizada — deixando a migração futura como uma troca de "casca"
(decorators, container de DI, entities) em vez de uma reescrita.

| Prioridade | Alvo | Por quê |
|---|---|---|
| 1 | Kernel compartilhado (config, realtime, erros) | Destrava todo o resto; mata o Problema 3 e 6 |
| 2 | Padrão-piloto num domínio pequeno | Fixa o template dos Problemas 1, 2 e 4 |
| 3 | Rollout módulo a módulo (CRUDs → núcleo → wbot) | Volume; risco crescente controlado |
| 4 | Frontend (API layer → reducer único → componentes-deus) | Espelha o kernel e mata o Problema 5 |
