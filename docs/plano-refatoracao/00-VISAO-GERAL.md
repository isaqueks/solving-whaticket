# Plano de Refatoração — Visão Geral

> Data: 23/07/2026. Este plano cobre a refatoração **no nível do código**
> (organização, classes, padrões), preparando o terreno para a futura migração
> **NestJS + TypeORM** (backend) e **NextJS** (frontend) — sem executá-la agora.
>
> Documentos deste plano:
> - `00-VISAO-GERAL.md` (este) — objetivos, arquitetura-alvo, fases, mapa NestJS
> - `01-ANALISE-ESTRUTURAL.md` — diagnóstico do estado atual com métricas
> - `02-PLANO-BACKEND.md` — plano detalhado por fase/módulo do backend
> - `03-PLANO-FRONTEND.md` — plano detalhado do frontend
> - `04-PADROES-DE-CODIGO.md` — o padrão de código a seguir (o "contrato")

---

## 1. Objetivo

Sair de um fork Whaticket com estilo misto (funções soltas, padrões divergentes
entre arquivos, responsabilidades espalhadas) para um código **corporativo,
consistente e orientado a classes**:

- **Uma responsabilidade por arquivo; uma classe pública por arquivo.**
- Camadas explícitas: `Controller → Service → Repository → Model`.
- SOLID pragmático: SRP e DIP de verdade; OCP/ISP onde agregam; nada de
  abstração especulativa.
- Cada passo verificável (`tsc`, build, smoke test) e reversível.

## 2. O que NÃO é objetivo agora

- Migrar framework (NestJS/NextJS/TypeORM) — o plano só **prepara** isso.
- Reescrever lógica de negócio que funciona (chatbot, campanhas, wbot).
- Adicionar DI container, CQRS, event sourcing, hexagonal "по livro" — exagero
  para o tamanho do sistema (1 empresa, 1 conexão).
- Converter componentes React para classes — em React moderno (e no NextJS),
  componentes funcionais + hooks são o padrão; classes no frontend ficam para
  a camada de serviços/API, não para UI.

## 3. Arquitetura-alvo (backend)

```
backend/src/
├── @types/
├── config/                  # acesso a env centralizado (AppConfig)
├── shared/                  # kernel compartilhado
│   ├── errors/AppError.ts
│   ├── logger/Logger.ts
│   ├── cache/CacheService.ts        (hoje libs/cache)
│   ├── realtime/SocketServer.ts     (hoje libs/socket)
│   ├── realtime/TicketEvents.ts     # TODOS os nomes de evento/sala em 1 lugar
│   └── database/                    (hoje database/)
├── modules/
│   ├── tickets/
│   │   ├── TicketsController.ts     # classe; só HTTP: valida → chama service → responde
│   │   ├── TicketsService.ts        # classe; regra de negócio do domínio
│   │   ├── TicketsRepository.ts     # classe; ÚNICO lugar que toca o model Ticket
│   │   ├── tickets.routes.ts
│   │   ├── dtos/                    # interfaces de entrada/saída
│   │   └── models/Ticket.ts
│   ├── contacts/ …
│   ├── messages/ …
│   ├── whatsapp-session/            # wbot: SessionManager, listener e módulos wbot*
│   ├── chatbot/                     # fluxo de filas/atendimento automático
│   ├── campaigns/ …
│   ├── schedules/ …
│   ├── users/ …  auth/ …  settings/ …  tags/ …  quick-messages/ …
│   └── …
└── jobs/                            # hoje queues/ — processadores Bull
```

Regras da arquitetura (detalhes no `04-PADROES-DE-CODIGO.md`):

1. **Controller** não contém regra de negócio nem acesso a model; não emite
   socket. Só: parse/validação de entrada → service → resposta HTTP.
2. **Service** é classe com métodos coesos do domínio (`TicketsService.create`,
   `.transfer`, `.close`…). Injeta dependências **pelo construtor** (manual,
   com defaults — sem framework de DI; o NestJS trará o container depois).
3. **Repository** é o único lugar com `Model.findOne/create/update`. É a
   fronteira que torna a troca Sequelize → TypeORM um problema local.
4. **Eventos de socket**: nomes de evento e sala viram constantes/factory em
   `shared/realtime/` — os 3 bugs de nome de evento achados na análise round 1
   só existiram porque cada arquivo montava strings à mão.
5. **Use-cases atuais** (`CreateTicketService` etc.) são absorvidos como
   métodos das classes de domínio — some a proliferação de 1-função-por-arquivo.

## 4. Mapa de migração futura (por que essa forma prepara o NestJS)

| Agora (Express, este plano) | Depois (NestJS/TypeORM) | Esforço da troca |
|---|---|---|
| `TicketsController` (classe) | `@Controller("tickets")` — mesma classe + decorators | Baixo |
| `TicketsService` (classe, deps no construtor) | `@Injectable()` — o container assume a injeção | Baixo |
| `TicketsRepository` (classe sobre Sequelize) | Repositório TypeORM (mesma interface pública) | Médio, mas **local** |
| `dtos/*.ts` (interfaces) | DTOs com `class-validator` | Baixo |
| `tickets.routes.ts` + `isAuth` | Decorators de rota + `Guard` | Baixo |
| `shared/realtime/SocketServer` | `@WebSocketGateway` | Médio |
| `jobs/*` (Bull) | `@nestjs/bull` — processors viram classes decoradas | Baixo |
| Crons em `jobs/ticketJobs` | `@nestjs/schedule` | Baixo |
| `config/AppConfig` | `@nestjs/config` (`ConfigService`) | Baixo |
| Models sequelize-typescript (decorators) | Entities TypeORM (decorators equivalentes) | Médio |

Frontend: organização por feature + hooks de domínio + camada de API em classes
mapeia direto para NextJS (`app/` por rota, hooks reaproveitados, API client
igual). Detalhes no `03-PLANO-FRONTEND.md`.

## 5. Fases (visão de alto nível)

| Fase | Conteúdo | Risco | Dependências |
|---|---|---|---|
| **B0** | Fundações backend: `shared/` (Logger, AppConfig, AppError, CacheService), constantes de eventos/salas de socket, aliases de path | Baixo | — |
| **B1** | Módulo-piloto **Tags** (menor domínio real): padrão completo Controller/Service/Repository/DTO documentado como template | Baixo | B0 |
| **B2** | CRUDs simples no padrão: QuickMessages, TicketNotes, Schedules, Settings, Help, Users | Baixo | B1 |
| **B3** | Domínios médios: Contacts, Queues (setores), Whatsapp (CRUD de conexão), Files, Reports/Dashboard | Médio | B2 |
| **B4** | Núcleo: Messages, Tickets (absorve os ~15 use-cases e helpers de ticket) | Alto | B3 |
| **B5** | Sessão WhatsApp: `SessionManager` (classe sobre libs/wbot), listener e módulos `wbot*` viram classes; Chatbot flow como serviço | Alto | B4 |
| **B6** | Campaigns + jobs (`queues/` → `jobs/` com classes de processador) | Médio | B4 |
| **B7** | Endurecimento de tipagem: liga `noImplicitAny` + flags de fluxo em degraus (`strictNullChecks` fica para a troca TypeORM) | Baixo | B6 |
| **F0** | Fundações frontend: API client + services de domínio (classes), constantes de eventos de socket compartilhando nomes com o backend, hook `useSocketEvent` | Baixo | B0 (eventos) |
| **F1** | Substituir os N reducers copiados por um `createEntityReducer` único + hooks de domínio | Médio | F0 |
| **F2** | Quebrar componentes-deus (MessagesList, MessageInputCustom, Dashboard, TicketsManagerTabs…) em subcomponentes + hooks | Médio | F1 |
| **F3** | Padronização final (exports, pastas por feature, remoção de estilos/strings duplicados) | Baixo | F2 |

Ordem recomendada de execução: `B0 → B1 → F0 → B2 → F1 → B3 → F2 → B4 → B5 → B6 → F3`.
Backend e frontend podem intercalar; cada fase termina com `tsc` limpo, build
verde e smoke test do domínio tocado.

## 6. Estratégia de verificação

1. `npx tsc --noEmit` (backend) e build CRA (frontend) a cada lote.
2. Smoke test manual do domínio refatorado (lista no plano de cada fase).
3. Nada de mudança de comportamento junto com mudança de estrutura no mesmo
   commit — refatoração estrutural é sempre um commit próprio.
4. Rotas, contratos HTTP e eventos de socket **não mudam** durante o plano
   (exceto onde já documentado como bug).

## 7. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Quebrar o fluxo de mensagens (núcleo) | Fases B4/B5 por último, com o padrão já rodado 3× em domínios menores |
| Sequelize v5 typings ruins poluindo as classes | Repositories concentram os casts/`any` — o resto do código fica limpo |
| Big-bang acidental | Módulo a módulo; o padrão antigo e o novo convivem (rotas antigas seguem funcionando até o módulo migrar) |
| Integração last-contact / boleto | Intocáveis; cobertas por smoke test próprio em toda fase que tocar mensagens |
