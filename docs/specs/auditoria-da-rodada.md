# `auditoria-da-rodada`

> Spec de fatia da Trilha, escrito pelo líder da v1 (`docs/specs/2026-11-14-autonomia-v1.md`).
> Fluxo da equipe: `docs/specs/2026-10-24-equipe-design.md`.

| | |
|---|---|
| **Fatia** | `auditoria-da-rodada` (onda 4) |
| **Modo** | Back |
| **Parte de** | `placar-e-lances` (parecer do Head de Engenharia, 30 out 2026) |
| **Status** | rascunho |
| **Base** | develop @1021769 |
| **Depende de** | votacao, rodizio-reservas |
| **Toca em** | apps/api/prisma/schema.prisma, packages/domain/src/round, packages/shared/src/round-log.ts, packages/shared/src/index.ts, apps/api/src/audit, apps/api/src/common, apps/api/src/match, apps/api/src/lineups/lineups.service.ts, apps/api/src/voting, apps/api/src/rounds/round-lock.service.ts, apps/api/src/setup-app.ts, apps/api/src/main.ts, apps/api/src/app.module.ts |

## Produto

### Objetivo
Toda mudança de **placar, etapa e lance** de uma rodada fica registrada: quem fez, o quê, quando, como estava antes
e como ficou. Quando alguém disser "quem mudou o placar?" ou "sumiu um gol meu", o admin abre o registro e vê. E
cada pedido à API ganha um identificador que aparece nos logs e na resposta, para achar um erro sem adivinhar.

### Quem usa
- **Admin:** lê o registro de uma rodada pela API (sem tela nesta fatia).
- **Dono / quem opera:** lê os logs da API (Render) com `requestId` e usuário.
- **Jogador:** não vê o registro (403). Nada muda para ele.
- **Usuário de outro grupo, ou membro inativo:** 404.

### Regras de domínio
- **O que entra no registro** (`ROUND_LOG_ACTIONS`): publicar e despublicar os times, começar o jogo, lançar ou
  corrigir o placar, finalizar o jogo, abrir a votação, fechar a votação (pelo admin, pelo prazo ou porque todos
  votaram), lançar lance e apagar lance.
- **O que não entra:** o **voto** (é anônimo: nem o conteúdo nem "fulano votou"), presença, rascunho dos times,
  criar e editar a rodada, rodízio.
- **Na mesma transação da escrita:** ou grava a mudança e a linha do registro, ou nenhuma das duas. Pedido
  recusado (403, 404, 409) não deixa linha.
- **Quem fez:** a participação (`Membership`) de quem pediu. No fechamento automático da votação, ninguém
  (`actorId` nulo).
- **O registro não muda:** só inserção. Apagar a rodada (só dá antes do jogo) apaga o registro dela junto.
- **Antes e depois** são um retrato pequeno do que mudou, sem dado pessoal além do id da participação:

| Ação | `before` | `after` |
|---|---|---|
| `TEAMS_PUBLISHED` / `TEAMS_UNPUBLISHED` / `MATCH_STARTED` / `VOTING_OPENED` | `{ status }` | `{ status }` |
| `SCORE_SET` | `{ score }` (ou `null`) | `{ score }` |
| `MATCH_FINISHED` | `{ status, score }` | `{ status, score }` |
| `EVENT_LAUNCHED` | `null` | `{ eventId, type, playerId }` |
| `EVENT_REMOVED` | `{ eventId, type, playerId, createdById }` | `null` |
| `VOTING_CLOSED` | `{ status }` | `{ status, reason, voted, total }` |

### Cenários
Cada cenário tem um id. Os testes levam o id no nome.

**Domínio**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C1 | `ROUND_LOG_ACTIONS` | conferir | as 9 ações da tabela, iguais ao enum `RoundLogAction` do banco | unitário (`domain-enums.spec.ts`) |

**API: registro**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C2 | admin publica os times; depois despublica | `POST .../lineup/publish` e `unpublish` | uma linha por chamada (`TEAMS_PUBLISHED`, `TEAMS_UNPUBLISHED`), com `actorId` do admin, `before`/`after` com o status e o `requestId` do pedido | integração |
| C3 | admin | `start`, `PUT score` 1x0, `PUT score` 2x0, `finish` 3x2, `open-voting` | 5 linhas na ordem, com as ações certas; a 2ª de placar tem `before: { score: { WHITE: 1, BLACK: 0 } }`; a de `finish` tem status e placar antes e depois | integração |
| C4 | Resenha | jogador lança o próprio gol e depois apaga; admin lança um gol contra de outro | 3 linhas: `EVENT_LAUNCHED` (ator = o jogador), `EVENT_REMOVED` (com o lance inteiro em `before`), `EVENT_LAUNCHED` (ator = admin, `playerId` = quem fez) | integração |
| C5 | pedido recusado: gol passando do placar (409), lance de outro (403), `start` fora de ordem (409), rodada de outro grupo (404) | — | nenhuma linha nova | integração |
| C6 | dois gols simultâneos no limite do placar (`Promise.all`, como o C59 de `placar-e-lances`) | — | um 200 e um 409, e **uma** linha de `EVENT_LAUNCHED` | integração |
| C7 | admin encerra a votação | `POST .../voting/close` | `VOTING_CLOSED` com `reason: 'ADMIN_CLOSED'`, `voted`, `total` e o ator | integração |
| C8 | o último voto fecha a votação; o prazo vence e o relógio fecha | — | `VOTING_CLOSED` com `ALL_VOTED` / `DEADLINE_PASSED` e `actorId: null`. **Nenhuma** linha por voto, e nenhum campo com nota, Craque ou Perna de Pau | integração |
| C9 | falha no meio da transação (lance com `membershipId` inexistente passando pela validação num teste que força o erro de chave) | — | nem o lance nem a linha ficam gravados | integração |
| C10 | admin | `GET .../rounds/:roundId/log` | as linhas em ordem de tempo, cada uma com `action`, `label` (texto do shared), `actor` (`membershipId`, apelido; `null` no automático), `before`, `after`, `createdAt` | integração |
| C11 | jogador comum | `GET .../log` | 403 | integração |
| C12 | rodada de outro grupo, não membro, membro inativo | `GET .../log` | 404 | integração |
| C13 | rodada `SCHEDULED` com linhas de publicar e despublicar | admin apaga a rodada | as linhas somem junto (cascade); nenhuma sobra órfã | integração |
| C14 | seed | rodar | as rodadas do seed não ganham linhas de registro (o seed grava direto) e o `GET .../log` delas responde `[]` | integração (`seed.spec.ts`) |

**API: `requestId` e logs**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C15 | qualquer pedido, com e sem sessão | chamar a API | a resposta traz o cabeçalho `x-request-id` (UUID) | integração |
| C16 | pedido com `x-request-id: abc-123_DEF45` | chamar | a resposta devolve o mesmo valor, e a linha do registro criada por esse pedido guarda esse valor | integração |
| C17 | `x-request-id` com 200 caracteres, com espaço ou com quebra de linha | chamar | o valor é ignorado e a API gera um novo | integração |
| C18 | pedido autenticado numa rota de grupo | olhar o log (logger capturado no teste) | uma linha JSON por pedido: `requestId`, `method`, `path` (sem query), `status`, `durationMs`, `userId`, `groupId`. Nunca corpo, cookie, email nem nome | integração |
| C19 | erro 500 forçado (rota de teste ou `PrismaService` derrubado) | chamar | o log de erro traz o `requestId` e a pilha; o corpo da resposta traz `{ statusCode: 500, message, requestId }`, sem a pilha | integração |
| C20 | dois pedidos ao mesmo tempo | conferir | cada linha de log e cada linha do registro leva o `requestId` do próprio pedido (sem trocar entre eles) | integração |
| C21 | `NODE_ENV=test` | rodar os testes | o log de pedido não polui a saída (nível silencioso) | integração |
| C22 | `GET /api/health` | chamar | responde como hoje, com `x-request-id`; não escreve linha de log de pedido (o Render chama a cada poucos segundos) | integração |

## Técnico

### Contrato
Schemas em `packages/shared/src/round-log.ts` (arquivo novo, exportado no `index.ts`).

| Método | Rota (sob `/api`) | Quem pode | Request | Response | Erros |
|---|---|---|---|---|---|
| `GET` | `/groups/:groupId/rounds/:roundId/log` | admin | — | `RoundLogEntry[]` | 403; 404 |

Todas as respostas da API passam a levar o cabeçalho `x-request-id`. Erro 500 passa a ter `requestId` no corpo.
Nenhuma outra rota muda de forma.

```ts
// packages/shared/src/round-log.ts
export const roundLogActionSchema = z.enum(ROUND_LOG_ACTIONS);
export const ROUND_LOG_ACTION_LABELS: Readonly<Record<RoundLogAction, string>> = {
  TEAMS_PUBLISHED: 'Times publicados',
  TEAMS_UNPUBLISHED: 'Times despublicados',
  MATCH_STARTED: 'Jogo começou',
  SCORE_SET: 'Placar lançado',
  MATCH_FINISHED: 'Jogo finalizado',
  VOTING_OPENED: 'Votação aberta',
  VOTING_CLOSED: 'Votação fechada',
  EVENT_LAUNCHED: 'Lance lançado',
  EVENT_REMOVED: 'Lance apagado',
};

export const roundLogEntrySchema = z.object({
  id: z.string(),
  action: roundLogActionSchema,
  label: z.string(),
  /** Quem fez. Nulo = automático (fechamento da votação). */
  actor: z.object({ membershipId: z.string(), nickname: z.string() }).nullable(),
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.iso.datetime(),
});
// tipos: RoundLogAction (re-export), RoundLogEntry
```

### Banco (`schema.prisma`)
Model novo **`RoundLog`**:
- `id String @id @default(cuid())`
- `groupId String` (→ `Group`)
- `roundId String` (→ `Round`, `onDelete: Cascade`)
- `actorId String?` (→ `Membership`)
- `action RoundLogAction`
- `before Json?`, `after Json?`
- `requestId String?`
- `createdAt DateTime @default(now())`
- `@@index([roundId, createdAt])` e `@@index([groupId, createdAt])`

Enum novo `RoundLogAction`, igual ao domain. **`Round`**, **`Group`** e **`Membership`** ganham só a relação, sem
coluna. Uma migration (`round_log`).

### Domínio
`packages/domain/src/round/log.ts`: `ROUND_LOG_ACTIONS` (lista `as const`) e o tipo `RoundLogAction`. É só o
vocabulário: o domínio continua sem saber de banco. Entrada nova no `CONTEXT.md` ("Registro da rodada"), dizendo o
que entra, o que não entra e que voto nunca é registrado.

Na API:
- **`apps/api/src/common/request-context.ts`:** `AsyncLocalStorage` com `{ requestId, userId?, groupId? }`.
  Um middleware no `setupApp` (antes de tudo) cria o contexto, valida o `x-request-id` recebido
  (`/^[A-Za-z0-9_-]{8,64}$/`) ou gera um com `crypto.randomUUID()`, e põe o cabeçalho na resposta. Os guards de
  sessão e de grupo completam `userId` e `groupId`.
- **Log de pedido:** um interceptor global escreve uma linha ao terminar (menos em `/api/health`). Em produção o
  logger do Nest sai em JSON (opção `json` do `ConsoleLogger`; conferir na versão instalada); em dev, texto. Um
  filtro global de exceção põe o `requestId` no corpo do 500 e no log de erro.
- **`apps/api/src/audit`:** `AuditService.record(tx, { groupId, roundId, actorId, action, before, after })` grava
  com o `tx` recebido e lê o `requestId` do contexto. `AuditController` com o `GET`.
- **Pontos de gravação** (todos dentro da transação que já existe):
  - `match.service`: `start`, `setScore`, `finish`, `openVoting`, `launchEvent`, `removeEvent`. O `before` sai do
    estado carregado no `tx` (com a rodada travada), não de uma leitura anterior.
  - `lineups.service`: `publish` e `unpublish` (método `transition`).
  - `voting`: o método único de fechar (`close`), com o motivo; `actorId` só quando foi o admin.
- **Garantia de cobertura:** um teste percorre as rotas de escrita de `match`, `lineup/publish|unpublish` e
  `voting/close` e falha se alguma responder 200 sem criar linha (lista de rotas no próprio teste; rota nova de
  escrita de rodada entra ali).
- Sem dependência nova (`node:async_hooks`, `node:crypto`).

### Tela
Sem tela.

### Decisões
- `before`/`after` em JSON pequeno, por ação — o registro serve para responder "o que mudou"; não é cópia da
  rodada inteira.
- Voto fora do registro — o voto é anônimo; nem a existência dele por pessoa entra.
- Leitura só por API e só para admin — resolve a disputa sem desenhar tela agora; a tela pode vir depois sem mudar
  o contrato.
- Depois de `votacao` e `rodizio-reservas` — um PR só liga o registro em todos os pontos de escrita que existem,
  em vez de cada fatia ligar o seu.
- `requestId` em `AsyncLocalStorage` — chega ao registro e ao log sem passar parâmetro por toda a pilha.
- Seed não gera registro — ele não passa pelos services; o histórico do seed não tem "quem fez".

## Fora do escopo
- Tela do registro para o admin.
- Registrar presença, rascunho de times, criação e edição de rodada, rodízio e perfil.
- Desfazer uma ação a partir do registro.
- Guardar o log de pedidos em serviço externo (Sentry entra em `producao`).

## Perguntas respondidas pelo dono
- Auditoria e `requestId`? → Aprovados no parecer do Head de Engenharia (30 out 2026).
- Sem pergunta nova.

## QA
<Preenchido no fim: tabela final do QA, número de voltas e veredito.>
