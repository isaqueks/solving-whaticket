# Padrões de Código — o contrato

> Vale para todo código novo e todo código tocado pela refatoração.
> Pragmático por definição: se uma regra atrapalhar um caso concreto, a exceção
> é permitida **com comentário justificando**.

## 1. Arquivos e nomes

- **Uma classe pública por arquivo**; o arquivo tem o nome da classe:
  `TicketsService.ts`, `TicketsRepository.ts`, `SessionManager.ts`.
- Pastas de módulo em kebab-case (`quick-messages/`), arquivos de classe em
  PascalCase, demais em camelCase (`tickets.routes.ts`).
- Identificadores em **inglês**; strings de UI/mensagens ao cliente em
  português. (Hoje há mistura: `dataLimite`, `ultima_msg`, `Agora` — migrar ao
  tocar.)
- Proibido: sufixos `_OLD`, `Copy`, arquivos `.bak`, código comentado "para
  depois" (o git é o histórico).

## 2. Classes em vez de funções soltas

**Antes (padrão atual):**
```ts
// services/TagServices/CreateService.ts
interface Request { name: string; color: string; companyId: number }
const CreateService = async ({ name, color, companyId }: Request): Promise<Tag> => {
  // valida + cria + retorna
};
export default CreateService;
```

**Depois:**
```ts
// modules/tags/TagsService.ts
export class TagsService {
  constructor(private readonly repository = new TagsRepository()) {}

  public async create(dto: CreateTagDto): Promise<Tag> {
    await this.validate(dto);
    return this.repository.create(dto);
  }

  public async update(id: number, dto: UpdateTagDto): Promise<Tag> { … }
  public async delete(id: number): Promise<void> { … }

  private async validate(dto: CreateTagDto): Promise<void> { … }
}
```

Regras:
- Dependências entram **pelo construtor com default** (`repository = new
  TagsRepository()`): testável hoje, vira `@Injectable` amanhã sem reescrever.
- Métodos públicos = casos de uso do domínio. Métodos privados = passos.
- Funções soltas só são aceitas para **utilitários puros** (sem I/O, sem
  estado) em `shared/utils/`, e mesmo assim agrupadas por tema.
- Services **não** guardam estado mutável de requisição em `this` (a instância
  é compartilhada).

## 3. Camadas

```
Controller  → HTTP apenas: parse, validação de entrada, status code.
Service     → regra de negócio; orquestra repositories e outros services;
              emite eventos de domínio via RealtimeGateway (nunca io.to direto).
Repository  → único lugar com Model.findOne/create/update/destroy.
Model       → definição de schema + associações. Sem lógica de negócio.
```

- Controller nunca importa Model. Service nunca monta query Sequelize (isso é
  do repository). Repository nunca emite socket nem lança erro de negócio —
  retorna dados/null e o service decide.
- **Exceção pragmática:** joins/includes complexos ficam no repository como
  métodos nomeados (`findWithQueueAndUser(id)`), não vazam `include: [...]`
  para o service.

## 4. DTOs e tipos

- Entrada e saída de cada método público de service tipadas com interface em
  `dtos/` (`CreateTagDto`, `TicketListFilters`). Nada de `data: any`.
- `any` só com justificativa em comentário (ex.: typings quebrados do
  Sequelize v5) e confinado ao repository.
- Habilitar gradualmente `noImplicitAny` (ver plano backend, fase B0).

## 5. Fluxo de controle

- **Guard clauses / early return** — `if (!x) return;` no topo, caminho feliz
  sem indentação profunda. `if (a) { return x; } return y;` em vez de if/else.
- Máximo ~2 níveis de indentação em método; passou disso, extraia método
  privado.
- `for…of` + `await` para processamento sequencial; `Promise.all` só quando o
  paralelismo é intencional e seguro. **Nunca** `forEach(async …)`.

## 6. Erros e logging

- Erro de negócio: `throw new AppError("ERR_X", status)` — sempre com código de
  erro estável (o frontend traduz).
- Nunca engolir erro: ou trata (com log do motivo), ou propaga. `catch` vazio é
  proibido; `catch (e) { logger.error(e) }` precisa dizer o contexto:
  `logger.error({ err: e }, "Falha ao sincronizar participantes do grupo %d", id)`.
- `console.*` proibido no backend — só `logger` (pino). No frontend, só atrás
  de `NODE_ENV !== "production"`.

## 7. Realtime (socket)

- Todos os nomes de evento e de sala em `shared/realtime/events.ts`:
```ts
export const TicketEvents = {
  changed: (companyId: number) => `company-${companyId}-ticket`,
  appMessage: (companyId: number) => `company-${companyId}-appMessage`,
};
export const Rooms = {
  status: (companyId: number, status: string) => `company-${companyId}-${status}`,
  notification: (companyId: number) => `company-${companyId}-notification`,
  ticket: (ticketId: number) => String(ticketId),
};
```
- Emissão só via `RealtimeGateway` (classe em `shared/realtime/`), chamada
  pelos services. O frontend importa um espelho dessas constantes
  (`src/services/socketEvents.js`) — um contrato, dois lados.

## 8. Config

- `process.env` lido **uma vez**, em `config/AppConfig.ts` (classe/objeto
  tipado com validação de presença no boot). O resto do código importa
  `appConfig.frontendUrl`, nunca `process.env.FRONTEND_URL`.

## 9. Frontend (específico)

- Componentes **funcionais** + hooks (padrão React/NextJS — classes aqui seriam
  ir contra a plataforma). As classes do frontend vivem na camada de serviços:
  `api/TicketsApi.js`, `api/ContactsApi.js` (métodos por endpoint, axios
  encapsulado).
- Componente > ~250 linhas é candidato a quebra; lógica não-visual (socket,
  fetch, reducer) sai para hook (`useTicketsList`, `useMessageSocket`).
- Um único `createEntityReducer(entityName)` genérico substitui os reducers
  LOAD/UPDATE/DELETE copiados página a página.
- Exports: componente é `export default` no `index.js` da sua pasta; todo o
  resto named export.

## 10. Duplicação: tolerância zero

- **Código duplicado é bug de manutenção.** Se o mesmo trecho aparece 2×,
  extraia na hora: método privado (mesma classe), classe/serviço compartilhado
  (mesmo módulo) ou `shared/` (entre módulos). A regra vale para backend,
  frontend, SQL e JSX.
- Cópias "quase iguais" (drift) são o pior caso — unificar decidindo a versão
  canônica e parametrizando a diferença. Exemplos já conhecidos no projeto:
  os 6 `mediaUpload/deleteMedia` dos controllers (vira `MediaStorageService`),
  os reducers LOAD/UPDATE/DELETE copiados página a página no frontend (vira
  `createEntityReducer`), blocos de emissão de socket repetidos (vira
  `RealtimeGateway`).
- Limite do bom senso: duplicação **acidental** (dois trechos parecidos hoje,
  mas com motivos de mudança diferentes) não deve ser unificada à força —
  abstração errada custa mais que cópia. Na dúvida: espere a 3ª ocorrência
  (regra de três), depois extraia.

## 11. O que é exagero (não fazer)

- Interfaces `ITicketsService` com implementação única "por via das dúvidas".
- Genéricos elaborados em repositories (um `BaseRepository<T>` simples é ok;
  três níveis de herança não).
- Barrel files re-exportando o projeto inteiro.
- Mapper/Entity/Domain-object separados do model — o model Sequelize É o
  domínio deste sistema.
- Testes unitários de getter/setter; testes valem para regra de negócio
  (quando chegarem, prioridade: chatbot flow e tickets).

## 12. Template do módulo (B1)

Referência viva: `backend/src/modules/tags/` (piloto da fase B1). Todo módulo
B2+ copia esta forma.

```
modules/tags/
├── TagsController.ts    # classe; HTTP + Yup no boundary + permissão
├── TagsService.ts       # classe; casos de uso; realtime via gateway
├── TagsRepository.ts    # classe; ÚNICO ponto tocando os models do domínio
├── tags.routes.ts       # paths/verbos idênticos aos antigos
├── dtos/
│   ├── CreateTagDto.ts
│   ├── UpdateTagDto.ts
│   ├── ListTagsFilters.ts      # entrada + saída (ListTagsResult)
│   ├── SimpleListTagsFilters.ts
│   └── SyncTagsDto.ts
└── models/
    ├── Tag.ts           # movido de src/models/ (importadores atualizados)
    └── TicketTag.ts
```

**Convenção de rotas do template**: os handlers do controller são **arrow
properties** da classe (`public index = async (req, res) => {…}`) — `this`
fica preso à instância e o arquivo de rotas passa o método direto, sem
`.bind`:

```ts
// tags.routes.ts
const tagsRoutes = Router();
const tagsController = new TagsController();

tagsRoutes.get("/tags", isAuth, tagsController.index);
```

**Controller** — parse tipado do body (`as` declara o contrato; Yup valida em
runtime), guard de permissão privado, service faz o resto:

```ts
public store = async (req: Request, res: Response): Promise<Response> => {
  const { name, color, kanban } = req.body as Omit<CreateTagDto, "companyId">;
  const { companyId } = req.user;

  await this.validateSchema(
    Yup.object().shape({ name: Yup.string().required().min(3) }),
    { name }
  );

  const tag = await this.service.create({ name, color, kanban, companyId });

  return res.status(200).json(tag);
};
```

**Service** — deps no construtor com default; guard clause; evento de domínio
pelo `RealtimeGateway` com nome vindo de `SocketEvents`:

```ts
public async update(
  id: string | number,
  dto: UpdateTagDto,
  companyId: number
): Promise<Tag> {
  const tag = await this.show(id); // lança ERR_NO_TAG_FOUND 404

  const { name, color, kanban } = dto;
  const updated = await this.repository.update(tag, { name, color, kanban });

  this.emitTagEvent(companyId, { action: "update", tag: updated });

  return updated;
}
```

**Repository** — query Sequelize inteira aqui (o service nunca vê `include`/
`Op`); acesso a model de OUTRO domínio ganha `TODO(B4/…)` para migrar quando o
dono migrar:

```ts
public async findKanbanByCompany(companyId: number): Promise<Tag[]> {
  return Tag.findAll({
    where: { kanban: 1, companyId },
    order: [["id", "ASC"]],
    raw: true
  });
}

// TODO(B4): mover para TicketsRepository quando o módulo tickets migrar.
public async findTicketWithTags(ticketId: number): Promise<Ticket | null> {
  return Ticket.findByPk(ticketId, { include: [Tag] });
}
```

Checklist ao migrar um módulo: DoD 1–9 do doc 02 (fase B1), incluindo o passo
4b — `tsc --noEmit` com `noImplicitAny` ligado só para o módulo (tsconfig
temporário com `include` do módulo + `src/@types`) deve passar limpo.
