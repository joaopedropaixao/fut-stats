# `auditoria-da-rodada`

> Spec de fatia da Trilha, escrito pelo líder da v1 (`docs/specs/2026-11-14-autonomia-v1.md`).
> Fluxo da equipe: `docs/specs/2026-10-24-equipe-design.md`.

| | |
|---|---|
| **Fatia** | `auditoria-da-rodada` (onda 5) |
| **Modo** | Back |
| **Parte de** | `placar-e-lances` (parecer do Head de Engenharia, 30 out 2026) |
| **Status** | aprovado em 2026-11-14; extensão do feed decidida pelo dono em 2026-11-16 e implementada em 2026-11-17 (QA aprovado na volta 2) |
| **Base** | develop @1b9afa5 (rebase da extensão: o `feed` #74 entrou; migration refeita por cima da `20261117174123_feed`). Antes: @e97ee8d, com #62 a #69 e #72 conferidos |
| **Depende de** | votacao, rodizio-reservas, **feed** (extensão de 2026-11-16: o PR espera o `feed` entrar) |
| **Toca em** | apps/api/prisma/schema.prisma, packages/domain/src/round, packages/shared/src/round-log.ts, packages/shared/src/index.ts, apps/api/src/audit, apps/api/src/common, apps/api/src/match, apps/api/src/lineups/lineups.service.ts, apps/api/src/voting, apps/api/src/rounds/round-lock.service.ts, apps/api/src/setup-app.ts, apps/api/src/main.ts, apps/api/src/app.module.ts, packages/domain/src/feed/log.ts, apps/api/src/feed (`posts.service.ts`, `feed.module.ts`), apps/api/prisma/migrations (`audit_log`), apps/api/src/common (`all-exceptions.filter.ts`, `request-context.ts`, `request-log.ts`), apps/api/src/test, docs/operacao/registro.md, CONTEXT.md, docs/03-roadmap.md |

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
- **Antes e depois** são um retrato pequeno do que mudou, sem dado pessoal além do id da participação (na rodada; no
  feed a moderação guarda o conteúdo, ver "Ações do feed"). Salvar o mesmo placar de novo não muda nada e não grava:

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
> Modelo final depois da extensão do feed: ver **Extensão: feed**. O model abaixo nasceu como `RoundLog`; hoje é
> **`AuditLog`** (`roundId` e `postId` opcionais, enum `AuditAction`), numa migration só, `audit_log`, por cima da `feed`.

Model novo **`RoundLog`** (hoje `AuditLog`):
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
  - `voting`: grava no `closeRound` (`voting.service.ts`), o funil único dos três caminhos de fechamento:
    `close` do admin, o voto (`submitVote`: o último voto, ou o voto que chega depois do prazo e fecha ali) e
    `closeDueVotings` (o relógio `VotingCloser`, as leituras `view`/`result` depois do prazo e, desde o `feed`,
    **`FeedService.alerts()`**, que fecha as votações vencidas do grupo antes de montar os avisos: quarto caminho,
    coberto pelo C32). `closeRound` recebe
    o `actorId`: a participação do admin quando veio de `POST .../voting/close` (mesmo se o motivo real for
    `DEADLINE_PASSED`/`ALL_VOTED`), `null` em todos os outros caminhos (o voto continua anônimo: quem votou por
    último não aparece). **Linha sem ator não leva `requestId`** (nulo em todos esses caminhos, revisão do PR #73):
    o `requestId` do último voto, cruzado com o log de pedido (que tem o `userId`), diria quem votou por último, e o
    da leitura (votação, resultado, `GET /rounds`, avisos) diria quem abriu o app. Só `POST .../voting/close` leva
    ator e `requestId`.
  - **Fora, de propósito:** rodízio (`startRotation`/`stopRotation` em `match.service`), rascunho (`lineups.save`),
    criar/editar rodada (`rounds.service`). O teste de cobertura lista essas rotas como excluídas, para rota nova
    de escrita não passar despercebida.
- **Garantia de cobertura:** um teste percorre as rotas de escrita de `match` (fora o rodízio), `lineup/publish|unpublish` e
  `voting/close` e falha se alguma responder 200 sem criar linha (lista de rotas no próprio teste; rota nova de
  escrita de rodada entra ali). Ele também confere que as rotas `POST|PUT|DELETE` dos controllers de `match`,
  `lineups` e `voting` estão todas na lista de auditadas ou na de excluídas (rodízio, rascunho, voto).
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
- Jogador nunca é apagado (dono, 17 nov 2026) — mensalistas e avulsos vão de vez em quando; o admin desativa e
  reativa, e o app não apaga `Membership`. Por isso `AuditLog.actorId` é `ON DELETE RESTRICT`. Remoção de verdade é
  manual, no banco, pelo orquestrador, com o registro do membro apagado antes (passo a passo em
  `docs/operacao/registro.md`); o `collections/dev-session.ts` apaga registro e resenhas dos grupos de dev antes das
  participações (`apps/api/src/dev/dev-leftovers.ts`, coberto por `dev-leftovers.spec.ts`).
- Uma migration só (`audit_log`, por cima da `feed`), já com o `RESTRICT` — nenhuma das duas anteriores
  (`audit_log` e `audit_log_actor_restrict`) foi ao ar.

## Extensão: feed (dono, 2026-11-16)

O PR #73 (registro da rodada + `requestId`) fica parado até o `feed` entrar na `develop`. Depois, rebase em cima
dele (a migration desta fatia é refeita por cima da `feed`) e o registro passa a cobrir as escritas do feed.

**Para quê** (palavras do dono): é **interno**. Quando alguém mandar um bug, o dono quer saber quem fez o quê, qual
passo falhou e quanto demorou. Os usuários não precisam ver isso.

### Regras
- **Uma tabela só, do grupo.** O model `RoundLog` vira **`AuditLog`**, com `roundId` **opcional** (continua
  `onDelete: Cascade`: apagar a rodada leva o registro dela) e `postId` **opcional e sem chave estrangeira**
  (apagar a resenha **não** apaga o registro, senão ninguém descobre quem apagou). Enum `AuditAction` = ações da
  rodada + ações do feed. A rota e o contrato da rodada (`GET .../rounds/:roundId/log`, `RoundLogEntry`) não mudam.
- **Modelo final** (migration `audit_log`, por cima de `20261117174123_feed`; a `round_log` nunca foi mergeada e foi
  apagada): `AuditLog { id, groupId → Group, roundId? → Round (Cascade), postId? (sem FK), actorId? → Membership
  (Restrict, já na migration `audit_log`: a participação nunca é apagada, então `actorId` nulo é sempre
  automático e nunca "ator apagado"),
  action AuditAction, before Json?, after Json?, requestId?, createdAt }`, com índices `(roundId, createdAt)`,
  `(groupId, createdAt)`, `(postId, createdAt)`, `(actorId, createdAt)` e `(requestId)` (as consultas de
  `docs/operacao/registro.md`). Domain: `ROUND_LOG_ACTIONS` + `FEED_LOG_ACTIONS` = `AUDIT_ACTIONS` (igual ao enum).
- **Ações do feed** (`FEED_LOG_ACTIONS`, em `packages/domain/src/feed/log.ts`):

| Ação | Quando | `before` | `after` |
|---|---|---|---|
| `POST_CREATED` | admin publica resenha | `null` | `{ postId, title, body }` |
| `POST_EDITED` | admin edita resenha | `{ postId, title, body }` | `{ postId, title, body }` |
| `POST_DELETED` | admin apaga resenha | `{ postId, authorId, title, body, reactionCount, commentCount }` | `null` |
| `COMMENT_CREATED` | membro comenta | `null` | `{ postId, commentId, length }` (o texto já está no comentário) |
| `COMMENT_DELETED` | autor ou admin apaga | `{ postId, commentId, authorId, text }` | `null` |
| `REACTION_SET` | membro coloca ou troca | `{ postId, reaction }` (`reaction` nulo se não tinha) | `{ postId, reaction }` |
| `REACTION_REMOVED` | membro tira | `{ postId, reaction }` | `null` |

- **Texto apagado ou editado fica guardado** no `before` (decisão do dono, opção 1): responde "o que foi apagado e
  por quem". É a exceção ao "sem dado pessoal" da rodada: `POST_EDITED`, `POST_DELETED` e `COMMENT_DELETED` levam
  título, texto e comentário, como prova da moderação. Só quem opera lê (não há rota de leitura do feed).
- Mesmas garantias da rodada: mesma transação, pedido recusado não deixa linha, só inserção, `actorId` = quem pediu,
  `requestId` do contexto. `PUT` de reação igual à atual não muda nada e não deixa linha; `DELETE` de reação que não existe e apagar comentário
  que outro já apagou também não. As reações usam os nomes reais do domain (`BALL`, `CATFISH`, `OSS`, `YELLOW_CARD`,
  `POPCORN`). `length` do comentário conta caracteres (code points), não bytes. O `before` de editar e apagar resenha
  sai com a resenha travada (`FOR UPDATE`); reação trava por resenha e membro (`pg_advisory_xact_lock`), para dois
  `PUT` do mesmo membro nunca gravarem duas linhas para uma mudança só. Tirar a reação enquanto a resenha é apagada
  (cascata) responde 404 e não grava (`deleteMany` idempotente, nunca 500).
- **Sem rota de leitura do feed.** O registro do feed é para o dono, não para o admin do grupo: lê direto no banco,
  pelo `requestId` ou pelo usuário. `docs/operacao/registro.md` traz as consultas prontas (por `requestId`, por
  `userId` num intervalo, por resenha).
- **Log de pedido mais útil para bug:** a linha de pedido com status ≥ 400 passa a levar `errorCode` (o `code` do
  corpo do erro, ex. `NOT_OWN_COMMENT`, `INVALID_TRANSITION`; `null` se não tiver). O 400 do Zod não tem `code` no
  corpo; no log ele sai como `VALIDATION_FAILED` (derivado do `issues` do corpo, **sem mudar a resposta**). Pedido
  2xx sai sem a chave. Junto com `userId`, `path`,
  `status` e `durationMs`, mostra qual passo falhou e quanto demorou. Continua sem corpo, cookie, email ou nome.

### Cenários da extensão

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C23 | `FEED_LOG_ACTIONS` e `ROUND_LOG_ACTIONS` | conferir | juntos, iguais ao enum `AuditAction` do banco | unitário (`domain-enums.spec.ts`) |
| C24 | admin | publica, edita e apaga uma resenha | 3 linhas (`POST_CREATED`, `POST_EDITED` com texto antigo e novo, `POST_DELETED` com o texto e as contagens), `roundId` nulo, `postId` preenchido; as linhas **continuam** depois de apagar a resenha | integração |
| C25 | jogador | comenta e apaga o próprio; admin apaga o comentário de outro | `COMMENT_CREATED` (sem o texto), `COMMENT_DELETED` ×2 com o texto e o autor, ator certo em cada | integração |
| C26 | membro | `PUT` reação `BALL`, `PUT` `BALL` de novo, `PUT` `CATFISH`, `DELETE` (e `DELETE` de novo) | 3 linhas: `REACTION_SET` (null→BALL), `REACTION_SET` (BALL→CATFISH), `REACTION_REMOVED`; nenhuma pelo `PUT` repetido nem pelo segundo `DELETE` | integração |
| C27 | pedidos recusados do feed: jogador cria/edita/apaga resenha (403), apaga comentário de outro (403), texto inválido (400), resenha de outro grupo (404) | — | nenhuma linha nova | integração |
| C28 | dois `PUT` de reação simultâneos do mesmo membro (C16 do `feed`) | `Promise.all` | o estado final bate com a última linha; nunca duas linhas para uma mudança só | integração |
| C29 | admin apaga uma rodada `SCHEDULED` que tem linhas; o grupo tem linhas do feed | apagar | as linhas da rodada somem; as do feed ficam | integração |
| C30 | pedido que dá 403 `NOT_OWN_COMMENT`; pedido que dá 400 de validação | olhar o log de pedido | a linha traz `errorCode` (`NOT_OWN_COMMENT`; `VALIDATION_FAILED`) e `status`; recusa sem código (404, 401) sai com `errorCode: null`; pedido 2xx sai sem a chave | integração (`request-context.spec.ts`) |
| C31 | cobertura | percorrer as rotas `POST\|PUT\|PATCH\|DELETE` do controller do feed | toda rota de escrita está na lista de auditadas (200/201/204 → uma linha) ou de excluídas | integração (`audit-coverage.spec.ts`) |
| C32 | votação `VOTING` com prazo vencido (o 4º caminho de fechamento) | `GET .../feed/alerts`, e de novo por outra pessoa | uma linha `VOTING_CLOSED` (`DEADLINE_PASSED`, `actorId` nulo, `requestId` nulo); a segunda leitura não duplica; votação dentro do prazo, ou de outro grupo, não grava | integração (`audit-feed.spec.ts`) |
| C33 | membro com reação numa resenha; outra transação apaga a resenha e segura a trava | `DELETE .../reaction` | 404 (não 500), nenhuma linha nova | integração (`audit-feed.spec.ts`) |

## Fora do escopo
- Tela do registro para o admin.
- Registrar presença, rascunho de times, criação e edição de rodada, rodízio e perfil.
- Desfazer uma ação a partir do registro.
- Guardar o log de pedidos em serviço externo (Sentry entra em `producao`).

## Perguntas respondidas pelo dono
- Auditoria e `requestId`? → Aprovados no parecer do Head de Engenharia (30 out 2026).
- P14 · Auditoria depois de `votacao` (onda 4)? → Sim (14 nov 2026).
- Auditar o feed? → Sim, as escritas (opção 2), num registro do grupo; esperar o `feed` entrar (16 nov 2026).
- Guardar o texto apagado/editado? → Sim (opção 1). É uso interno do dono para investigar bug, não para os usuários
  (16 nov 2026).

## QA
**Volta 3 (code review do PR #73): APROVADO** (2026-11-17). Pronto na raiz verde (API 589 testes, domain, web e
shared sem regressão). `unreact` com a resenha apagada no meio responde 404 (C33 reproduz o 500 antigo com `delete`);
`VOTING_CLOSED` sem ator grava `requestId` nulo pelo último voto, pela visão da votação, por `GET /rounds`, pelo voto
atrasado e pelos avisos (C8, C32), e o "Encerrar votação" segue com ator e `requestId` (C7); o mesmo placar de novo não
grava linha (C3); `AuditLog.actorId` passou a `ON DELETE RESTRICT` (migration `20261117190000_audit_log_actor_restrict`,
sem drift: nenhum caminho do app apaga `Membership`, só `collections/dev-session.ts`, ferramenta de dev, em grupos de
dev sem rodada). C26, C28 e C33 rodados 5 vezes seguidas, estáveis.

**Volta 2 (extensão do feed): APROVADO** (2026-11-17, @ebc58ce sobre develop 1b9afa5). Pronto na raiz verde (API 587
testes em 29 suítes, domain 498, web 595, shared 4). Migration `20261117175943_audit_log` por cima da
`20261117174123_feed` (intacta); `migrate status` em dia e `migrate diff` banco → schema sem diferença.

| Cenário | Resultado | Evidência |
|---|---|---|
| C1–C22 (regressão após rebase e rename para `AuditLog`) | ✅ | `audit.spec.ts`, `request-context.spec.ts`, `seed.spec.ts`; contrato da rodada sem diff; fluxo real com 13 linhas na rodada 9 |
| C23 | ✅ | `packages/domain/src/feed/log.test.ts`, `domain-enums.spec.ts` |
| C24 | ✅ | `audit-feed.spec.ts` + fluxo real (linhas ficam depois de apagar a resenha) |
| C25 | ✅ | `audit-feed.spec.ts` + fluxo real (autor e admin apagando; delete repetido 404 sem linha) |
| C26 | ✅ | `audit-feed.spec.ts` + fluxo real (null→BALL→CATFISH→null; PUT repetido sem linha) |
| C27 | ✅ | `audit-feed.spec.ts` (inclui falha forçada por trigger) + fluxo real (0 linhas por `requestId` recusado) |
| C28 | ✅ | `audit-feed.spec.ts` + fluxo real (8 PUTs paralelos, cadeia before/after íntegra) |
| C29 | ✅ | `audit-feed.spec.ts` |
| C30 | ✅ | `request-context.spec.ts` + log real (`NOT_OWN_COMMENT`, `VALIDATION_FAILED`, `null` em 404/401) |
| C31 | ✅ | `audit-coverage.spec.ts` |
| C32 | ✅ | `audit-feed.spec.ts` + fluxo real (`GET feed/alerts` fecha a votação vencida: 1 `VOTING_CLOSED`, ator nulo, `requestId` do pedido; sem duplicar) |
| Multi-grupo | ✅ | fluxo real: feed não vaza para o log da rodada; resenha de outro grupo 404 sem linha |

Observações sem bloqueio: `AuditLog.actorId` com `ON DELETE SET NULL` (participação hoje só fica inativa, não é
apagada; virou `RESTRICT` na volta 3); no 403 de papel o log de pedido segue com `groupId: null`.

**Volta 1: (2026-11-16, @6ba5ab1 sobre develop e97ee8d). `pnpm turbo run lint typecheck
test build --force`: 17/17 tarefas (API 508 testes em 26 suítes, domain 465, web 530, shared 2).

| Cenário | Resultado | Evidência |
|---|---|---|
| C1 | ✅ | `packages/domain/src/round/log.test.ts`, `apps/api/src/prisma/domain-enums.spec.ts` |
| C2–C10, C13, C20 | ✅ | `apps/api/src/audit/audit.spec.ts` (C6 com `Promise.all` ×10; C8 ×4: último voto, relógio, leitura após o prazo, voto atrasado; C9 com trigger no banco forçando a falha) |
| C11, C12 | ✅ | `audit.spec.ts` (403 titular e reserva; 404 outro grupo, não membro, inativo, rodada inexistente; 401 sem sessão) |
| C14 | ✅ | `apps/api/src/seed/seed.spec.ts` |
| C15–C19, C21, C22 | ✅ | `apps/api/src/common/request-context.spec.ts` |
| Cobertura de rotas | ✅ | `apps/api/src/audit/audit-coverage.spec.ts` (toda rota de escrita de match/lineups/voting auditada ou excluída de propósito) |
| Fluxo real | ✅ | [`auditoria-da-rodada-evidencia.md`](auditoria-da-rodada-evidencia.md): 13 linhas, uma por escrita aceita; nenhuma por recusa, voto, presença ou rascunho |

Observações sem bloqueio: no 403 de papel o log de pedido sai com `groupId: null` (o guard recusa antes de anotar o
grupo; o `userId` aparece); C9 usa trigger em vez de `membershipId` inexistente (mesma prova, mais direta).
