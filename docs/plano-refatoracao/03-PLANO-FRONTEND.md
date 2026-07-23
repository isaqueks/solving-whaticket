# Plano de Refatoração — Frontend

> Base: inventário estrutural de 23/07/2026 (163 arquivos, ~31,8 mil linhas,
> CRA + JS + Material-UI v4). Números citados vêm desse levantamento.
> Direção futura: NextJS + TypeScript — este plano organiza o código de forma
> que a migração seja mover módulos, não reescrever lógica.

## Estado atual em números (o problema)

| Sintoma | Medição |
|---|---|
| Reducers LOAD/UPDATE/DELETE/RESET copiados | **18 arquivos** com o mesmo reducer colado (variando só o nome da entidade) |
| Acesso à API sem camada | **63 arquivos** chamam `api.get("/…")` inline; só 14 hooks encapsulam endpoints; `react-query` instalado e usado em **1** arquivo |
| Socket espalhado | **28 arquivos** montam nomes de evento na mão (`` `company-${id}-…` `` em ~20 pontos), com drift real: `company${id}-schedule` **sem hífen**, typo `quickemessage`, PascalCase (`-ContactList`) vs lowercase |
| Componentes-deus (>400 linhas) | **12** — MessagesList (1039: render + reducer + socket + áudio + scroll infinito), MessageInputCustom (927: input + gravação + emoji + upload + autocomplete), CampaignModal (772: Formik + **10 chamadas de API inline**), Settings/Options (720: **29 useState**) … |
| Tratamento de erro inconsistente | `toastError` importado em 64 arquivos, mas **48** chamam `toast.*` direto por fora |
| Dependências mortas | **14 pacotes com zero imports** (bootstrap, react-bootstrap, @mui/joy, styled-components, react-text-mask, text-mask-addons, react-currency-format, react-copy-to-clipboard, react-qr-code, gn-api-sdk-node, jsonwebtoken, use-debounce, formik-material-ui, e um pacote suspeito chamado `context`) |
| Duas versões de MUI | v4 (91 arquivos com makeStyles) + v5 (2 arquivos) + 2 libs de gráfico (chart.js e recharts) |
| Tailwind | Configurado e importado no App.css, **zero classes usadas** |
| i18n | 526 usos de `i18n.t`, mas ~41 strings PT hardcoded no JSX; catálogo `en` pela metade |
| Esquisitices | Pasta de hook literalmente chamada `useAuth.js/`; `VcardPreview.jsx` (único .jsx) convivendo com `components/VCardPreview/` |

---

## Fase F0 — Fundações (baixo risco, alto retorno)

**F0.1 — Camada de API em classes.** Criar `src/api/` com uma classe por
domínio encapsulando o axios:

```js
// src/api/BaseApi.js
export class BaseApi {
  constructor(http = api) { this.http = http; }
}

// src/api/TicketsApi.js
export class TicketsApi extends BaseApi {
  list(filters)        { return this.http.get("/tickets", { params: filters }); }
  show(id)             { return this.http.get(`/tickets/${id}`); }
  update(id, data)     { return this.http.put(`/tickets/${id}`, data); }
  // …um método por endpoint que o app realmente usa
}
export const ticketsApi = new TicketsApi();
```

Regra: componente **nunca** conhece URL. Os 14 hooks de domínio existentes
(`useTickets`, `useSettings`…) passam a delegar para essas classes (mantêm a
assinatura — os consumidores não mudam). Os 63 arquivos com chamadas inline
migram **conforme forem tocados** nas fases F1/F2 (não é um big-bang).

**F0.2 — Contrato de socket.** Criar `src/services/socketEvents.js` espelhando
as constantes do backend (fase B0 do plano backend): funções `TicketEvents.
changed(companyId)` etc. + hook `useSocketEvent(event, handler)` com cleanup
automático. Os drifts encontrados (`schedule`/`quickemessage` sem hífen/typo)
são **corrigidos em par com o backend** — hoje funcionam por acidente (os dois
lados têm o mesmo erro); a correção muda os dois lados no mesmo commit.

**F0.3 — Erro padronizado.** `toastError` vira o único canal de erro de API
(regra de lint mental: `toast.error` direto só para mensagens que não vêm de
erro HTTP). Migração gradual dos 48 arquivos, junto com F1/F2.

**F0.4 — Higiene de dependências.** Remover os 14 pacotes sem import
(atenção especial ao pacote `context` — nome de placeholder, sem função;
remover e rodar build). Decidir e executar: **remover o Tailwind** (config +
diretivas no App.css) — está morto e a decisão de estilo do NextJS virá depois.

**F0.5 — Correções de nome.** `hooks/useAuth.js/` → `hooks/useAuth/`;
unificar `VcardPreview.jsx` × `VCardPreview/` (uma implementação canônica,
extensão `.js` como o resto).

## Fase F1 — Matar a duplicação estrutural

**F1.1 — `createEntityReducer`.** Um único factory substitui os 18 reducers:

```js
// src/store/createEntityReducer.js
export const createEntityReducer = (extra = {}) => (state, action) => {
  switch (action.type) {
    case "LOAD":   return upsertMany(state, action.payload);
    case "UPDATE": return upsertOne(state, action.payload);
    case "DELETE": return state.filter(item => item.id !== action.payload);
    case "RESET":  return [];
    default:       return extra[action.type]?.(state, action) ?? state;
  }
};
```

Os casos one-off (`ADD_MESSAGE`, `RESET_UNREAD`, `UPDATE_TICKET_UNREAD_MESSAGES`,
`CHANGE_CHAT`, `UPDATE_SESSION`) entram via `extra`. Migrar os 18 arquivos um a
um (cada um é uma troca mecânica + smoke test da página).

**F1.2 — Hooks de listagem.** O trio "reducer + fetch paginado + socket
subscription" que toda página de listagem repete vira um hook por domínio
(`useContactsList`, `useCampaignsList`…) construído sobre `createEntityReducer`
+ `useSocketEvent` + a classe de API. As páginas ficam só com UI.

## Fase F2 — Quebrar os componentes-deus

Ordem por dor/risco (cada item = extração de subcomponentes + hooks, sem
mudança visual):

| Componente | Extrações previstas |
|---|---|
| `MessagesList` (1039) | `useMessagesSocket`, `useInfiniteMessages` (scroll+paginação), `MessageBubble`, `MessageMediaPreview` (imagem/áudio/vcard/localização), `AudioPlayer` |
| `MessageInputCustom` (927) | `useAudioRecorder` (mic-recorder), `EmojiPickerPopover`, `AttachmentButton`, `QuickMessagesAutocomplete`, `useMessageSender` (as 4 chamadas de API inline) |
| `CampaignModal` (772) | `campaignsApi` (10 chamadas inline → classe), subforms (dados, mensagens, agendamento, anexo) |
| `Settings/Options` (720) | descriptor `settingsSchema` (array de {key, label, type}) + componente genérico `SettingField` — os 29 `useState` viram 1 estado |
| `Dashboard` (813) | 1 componente por card/gráfico + `useDashboardFilters`; **unificar em 1 lib de gráficos** (recharts OU chart.js — hoje tem as duas) |
| `TicketListItemCustom` (517), `QueueModal` (490), `NewTicketModal` (414), `TicketsManagerTabs` (403), `QueueOptions` (401) | mesma receita: hooks para lógica, subcomponentes para blocos visuais |

Meta do padrão (doc 04): componente ≤ ~250 linhas, zero `api.*` inline, zero
`socket.on` fora de hooks.

## Fase F3 — Padronização final

- `console.*` (19 arquivos) atrás de guard de ambiente ou removidos.
- Strings PT hardcoded (~41) movidas para o catálogo `pt` (o `en` incompleto
  fica como está — empresa PT-BR, fallback já é pt).
- Blocos comentados mortos removidos (`useTickets`, `TicketsListCustom`…).
- MUI: **congelar** v4 como padrão do CRA atual; os 2 arquivos em v5 migram de
  volta ou ficam documentados como exceção — a troca de UI lib é decisão da
  migração NextJS, não deste plano.
- Exports e pastas: manter `export default` em `index.js` por pasta de
  componente (padrão dominante, 76/78 já seguem).

## Preparação NextJS (o que este plano já garante)

1. **Lógica fora da UI**: hooks + classes de API migram para o NextJS sem
   mudança (viram `lib/` / `hooks/` do projeto Next).
2. **Env centralizado**: acesso a `process.env.REACT_APP_*` concentrado em
   `src/config.js` (F0) — a troca para `NEXT_PUBLIC_*` é um arquivo.
3. **Rotas finas**: páginas viram cascas (`pages/Contacts` só composição) —
   mapeiam 1:1 para rotas do App Router.
4. **Socket isolado** em `SocketContext` + `useSocketEvent` — vira um provider
   no layout root do Next.
5. O que **não** fazer agora: adotar SSR/SSC patterns, trocar MUI, TypeScript
   no CRA — custo alto que a migração pagará de qualquer forma.

## Verificação por fase

Build CRA verde + smoke test das páginas tocadas (login, lista de tickets,
conversa com envio de texto/áudio/anexo, contatos, campanhas, configurações).
F1/F2 nunca misturam mudança visual com mudança estrutural no mesmo commit.

## Decisões congeladas (F3)

Fechadas nesta rodada de padronização; **reabertura só na migração NextJS**,
não em PRs do CRA atual.

- **MUI v4 é o padrão.** Todo componente novo ou tocado usa `@material-ui/core`
  + `makeStyles`. Existem **2 arquivos em v5** (`@mui/material` +
  `@mui/x-date-pickers`), mantidos como **exceção documentada** porque dependem
  do `DatePicker` do MUI X (sem equivalente direto no v4 do projeto):
  - `frontend/src/pages/Dashboard/ChartsDate.js`
  - `frontend/src/pages/Dashboard/ChartsUser.js`

  Não migrar de volta agora (risco visual/funcional no seletor de datas sem
  retorno). A unificação de UI lib é decisão da migração NextJS.

- **Libs de gráfico não unificadas.** Convivem duas: `recharts`
  (`pages/Dashboard/Chart.js`) e `chart.js` + `react-chartjs-2`
  (`pages/Dashboard/ChartsDate.js`, `pages/Dashboard/ChartsUser.js`).
  Unificar exigiria reescrever gráficos com risco visual real (eixos, tooltips,
  cores) sem ganho estrutural — **adiado para a migração NextJS**, onde a camada
  de dados (hooks/API) já vem pronta e só a renderização muda.

Ambas as decisões seguem o princípio do plano (doc 03 §Preparação NextJS):
não trocar UI/chart lib no CRA — custo alto que a migração paga de qualquer forma.
