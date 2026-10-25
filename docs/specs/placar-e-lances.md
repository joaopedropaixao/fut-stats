# `placar-e-lances`

> Spec de fatia da Trilha. Fluxo da equipe: `docs/specs/2026-10-24-equipe-design.md`.

| | |
|---|---|
| **Fatia** | `placar-e-lances` (#3 da Trilha) |
| **Modo** | Par |
| **Parte de** | PR #32 (fechar), branch `origin/feature/tela-placar-e-scouts` |
| **Status** | aprovado em 2026-10-25 |

## Produto

### Objetivo
O admin começa o jogo, finaliza informando o placar final e, se quiser, já lança os lances na resenha. A rodada
entra na **Resenha pós-jogo**: cada jogador vê o card **YOU WIN / YOU LOSE / EMPATE** e completa ou corrige os
próprios gols, assistências e gols contra, sem passar do placar. Quando os gols lançados batem com o placar, o
admin abre a votação, e a partir daí placar e lances congelam.

### Quem usa
- **Admin:** começa o jogo, lança e corrige o placar, finaliza o jogo, lança e apaga lances de qualquer um (em
  jogo e na Resenha) e abre a votação.
- **Jogador:** durante o jogo, só vê. Na Resenha, lança e apaga só os próprios lances. Vê o card de resultado uma
  vez, se jogou.
- **Usuário de outro grupo, ou membro inativo:** 404 em tudo.

### Ciclo da rodada (novo)
`SCHEDULED` → `TEAMS_PUBLISHED` → `IN_PROGRESS` (em jogo) → **`POST_MATCH` (Resenha pós-jogo)** → `VOTING` → `CLOSED`

| Etapa | Placar | Lances | Passa para a próxima quando |
|---|---|---|---|
| `IN_PROGRESS` | admin | **só admin** (de qualquer um) | admin finaliza informando o placar (`SCORE_MISSING`/`INVALID_SCORE` se faltar) |
| `POST_MATCH` | admin corrige | jogador os próprios, admin de qualquer um | admin abre a votação com **gols lançados = placar** em cada time e assistências ≤ gols |
| `VOTING` / `CLOSED` | congelado | congelado | (fatia `votacao`) |

### Regras de domínio
- Ciclo, placar e scouts ([CONTEXT.md › Rodada, placar e scouts](../../CONTEXT.md#rodada-placar-e-scouts-validateroundtransition--validatematchevent--shouldclosevoting-)),
  **com as mudanças desta fatia** (decisões do dono, 25 out 2026):
  - Status novo `POST_MATCH` ("Resenha pós-jogo") entre `IN_PROGRESS` e `VOTING`. `ROUND_TRANSITIONS`:
    `IN_PROGRESS: ['POST_MATCH']`, `POST_MATCH: ['VOTING']`.
  - Ir para `POST_MATCH` exige placar lançado e válido (`SCORE_MISSING`, `INVALID_SCORE`), sem exigir gols
    batendo. Ir para `VOTING` (e `CLOSED`) segue exigindo gols = placar e assistências ≤ gols.
  - **Durante o jogo só o admin lança:** em `IN_PROGRESS`, lance de jogador comum (até o próprio) devolve o
    código novo `'ADMIN_ONLY_IN_MATCH'`.
  - **Congela na votação:** lances e placar só em `IN_PROGRESS` e `POST_MATCH` (`isMatchOpen`). Em `VOTING` e
    `CLOSED`, `ROUND_NOT_OPEN`.
  - Gol contra: mesma regra de gol e assistência (jogador lança o próprio na Resenha; admin de qualquer um).
- `pickCurrentRound`: `POST_MATCH` conta como "em jogo" (vem primeiro, como `IN_PROGRESS`), para a rodada não sumir
  do início na Resenha.
- Presença: `POST_MATCH` trava como `IN_PROGRESS` (`ATTENDANCE_CLOSED`); não dá para apagar nem editar a rodada.
- Resultado do jogador: `matchResult(score, team)` → `'WIN' | 'LOSS' | 'DRAW'` (função nova).

### Cenários
Cada cenário tem um id (`C1`, `C2`...). Os testes levam o id no nome.

**Domínio**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C1 | rodada `IN_PROGRESS` sem placar | `validateRoundTransition(→ POST_MATCH)` | `['SCORE_MISSING']` | unitário |
| C2 | `IN_PROGRESS` com placar 3x2 e só 1 gol lançado | `→ POST_MATCH` | `[]` (gols não precisam bater ainda) | unitário |
| C3 | `IN_PROGRESS` | `→ VOTING` | `['INVALID_TRANSITION']` (não pula a Resenha) | unitário |
| C4 | `POST_MATCH` com gols ≠ placar, ou assistências > gols | `→ VOTING` | `GOALS_MISMATCH` / `TOO_MANY_ASSISTS` | unitário |
| C5 | `POST_MATCH` com gols = placar (gol contra contando para o adversário) | `→ VOTING` | `[]` | unitário |
| C6 | `IN_PROGRESS`, jogador comum | `validateMatchEvent` do próprio gol | `['ADMIN_ONLY_IN_MATCH']`; admin no mesmo cenário: `[]` | unitário |
| C7 | `POST_MATCH`, jogador | lança/apaga o próprio `GOAL`, `ASSIST` ou `OWN_GOAL` | `[]`; de outro jogador: `['NOT_OWN_EVENT']` | unitário |
| C8 | `POST_MATCH`, placar 2x1 com 1 gol do Preto lançado | jogador do Branco lança `OWN_GOAL` | `['GOALS_EXCEED_SCORE']` (conta para o Preto, que já está cheio) | unitário |
| C9 | `VOTING` ou `CLOSED` | lançar, apagar lance ou lançar placar (admin) | `['ROUND_NOT_OPEN']` | unitário |
| C10 | `POST_MATCH` | `validateScoreEntry` do admin | `[]`; abaixo dos gols: `SCORE_BELOW_GOALS` | unitário |
| C11 | placar 3x2 | `matchResult(score, 'WHITE')` / `'BLACK'`; 2x2 | `'WIN'` / `'LOSS'`; `'DRAW'` | unitário |
| C12 | rodadas `POST_MATCH` e `SCHEDULED` futura | `pickCurrentRound` | a `POST_MATCH` | unitário |
| C13 | `POST_MATCH` | `validateAttendanceChange` (admin) | `['ATTENDANCE_CLOSED']` | unitário |

**API**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C14 | membro, rodada em qualquer status | `GET .../match` | `MatchView`: times com quem jogou, lances com `team` = time que ganhou o lance, `tally`, `me`, `permissions` e `canRemove` por lance calculados com o domínio | integração |
| C15 | `TEAMS_PUBLISHED` com times válidos | admin `POST .../match/start` | 200, `IN_PROGRESS` | integração |
| C16 | `TEAMS_PUBLISHED` com confirmados ≠ escalados | `start` | 409 `ATTENDANCE_MISMATCH`; status não muda | integração |
| C17 | `IN_PROGRESS` | admin `PUT .../match/score` e `POST .../match/events` (de qualquer um, os 3 tipos) | 200; `createdById` = admin | integração |
| C18 | `IN_PROGRESS`, jogador comum | `POST .../events` do próprio gol | 403 `ADMIN_ONLY_IN_MATCH`; nada gravado | integração |
| C19 | `IN_PROGRESS` com 2x1 em gols lançados, sem placar | admin `POST .../match/finish` `{ WHITE: 3, BLACK: 1 }` | 200, placar gravado e `POST_MATCH` | integração |
| C20 | `IN_PROGRESS` com 2x1 em gols | `finish` `{ WHITE: 1, BLACK: 1 }` | 409 `SCORE_BELOW_GOALS`; nada muda | integração |
| C21 | `POST_MATCH`, jogador | lança e apaga o próprio lance | 200; lance de outro → 403 `NOT_OWN_EVENT`; passando do placar → 409 `GOALS_EXCEED_SCORE`/`ASSISTS_EXCEED_SCORE`; quem não jogou (ou de outro grupo) → 409 `PLAYER_DID_NOT_PLAY` | integração |
| C22 | `POST_MATCH` com gols ≠ placar | admin `POST .../match/open-voting` | 409 `GOALS_MISMATCH`; status não muda | integração |
| C23 | `POST_MATCH` com gols = placar | `open-voting` | 200, `VOTING` e `Round.votingOpenedAt` gravado (agora) | integração |
| C24 | `VOTING` | lance, apagar lance, placar | 409 `ROUND_NOT_OPEN` | integração |
| C25 | jogador comum | `start`, `score`, `finish`, `open-voting` | 403 | integração |
| C26 | transição fora de ordem (`start` em `SCHEDULED`, `finish` em `POST_MATCH`, `open-voting` em `IN_PROGRESS`) | — | 409 `INVALID_TRANSITION` | integração |
| C27 | rodada de outro grupo, grupo em que não é membro, membro inativo, lance de outra rodada | qualquer rota | 404 e nada muda | integração |
| C28 | `POST_MATCH` com placar 3x2, quem pede jogou no Branco / no Preto / não jogou | `GET` | `me.result` = `WIN` / `LOSS` / `null`; antes do `POST_MATCH`, `null` | integração |
| C29 | seed `--cenario=em-jogo` e `--cenario=resenha` | rodar o seed | em-jogo: `IN_PROGRESS`, placar nulo, 2x1 em gols lançados pelo admin; resenha: `POST_MATCH`, placar 3x2 com gols faltando, um gol contra; rodadas passadas passam por `POST_MATCH` e têm `votingOpenedAt` | integração (`seed.spec.ts`) |

**Tela** (`/rodadas/:roundId/jogo`, 390px, como admin e como jogador)

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C30 | admin, `TEAMS_PUBLISHED` | detalhe da rodada → "Ir para o jogo" → "Começar jogo" → gaveta → confirmar | rodada em jogo; se `permissions` disser que não pode, o motivo (texto do shared) e a tecla desabilitada | Playwright |
| C31 | admin, em jogo (seed em-jogo) | abrir a tela | placar grande mostra o placar ou, nulo, "–" com "PLACAR NÃO LANÇADO"; lances do Branco e do Preto com "n de m gols"; teclas "+ Gol", "+ Assistência", "+ Gol contra" | Playwright |
| C32 | admin | "+ Gol" → escolhe jogador (agrupado por time) | lance aparece no time certo com aviso e Desfazer; gol contra aparece na lista do **time que ganhou o gol**, com o anel do time de quem fez | Playwright |
| C33 | admin, em jogo | "Finalizar jogo" → gaveta com −/+ por time, partindo do placar lançado ou dos gols lançados → confirmar | rodada na Resenha com o placar; abaixo dos gols, a tecla avisa e não grava | Playwright |
| C34 | jogador, em jogo | abrir a tela | só leitura: placar, lances e "Seus lances entram na Resenha, depois do jogo"; sem teclas de lançar | Playwright |
| C35 | jogador que jogou, primeira vez na tela com a rodada em `POST_MATCH` ou depois | abrir a tela | grande momento **YOU WIN / YOU LOSE / EMPATE** com o placar final (até 2 s, pixel em degraus, "Pular" ≥ 44px); na segunda vez, não toca (lembrado por rodada no navegador; sem armazenamento, toca de novo e nada quebra). Quem não jogou não vê | Playwright |
| C36 | "reduzir movimento" | abrir | quadro final do card com fade, sem animação | Playwright (`emulateMedia`) |
| C37 | jogador, Resenha | "+ Meu gol" / "+ Minha assistência" / "+ Meu gol contra"; lixeira só nos próprios | lança e apaga; passou do placar → aviso com o texto do shared | Playwright |
| C38 | admin, Resenha | corrige o placar (−/+ grava) e lança/apaga de qualquer um | atualiza; "Abrir votação" desabilitada com o motivo enquanto os gols não batem | Playwright |
| C39 | admin, Resenha, gols batendo | "Abrir votação" → gaveta → confirmar | status "Votação"; tela só leitura para todos | Playwright |
| C40 | carregando, erro da API, rodada não encontrada, rodada antes do jogo (jogador) | abrir | esqueleto; erro com "Tentar de novo"; vazio de não encontrada; "O jogo ainda não começou" com link para os times. Console sem erros no fluxo real | Playwright |

**Início** (`/`, a rodada da vez)

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C41 | rodada da vez em `POST_MATCH`, jogador que jogou | abre o início | título "Hora da Resenha" e um card com o placar final (dígitos pixel, Branco x Preto) e a chamada "Lance seus gols e assistências"; a tecla "Lançar meus lances" leva a `/rodadas/:roundId/jogo`. Sem o card de presença | Playwright |
| C42 | rodada da vez em `POST_MATCH`, admin | abre o início | o mesmo card, com "Confira os lances e abra a votação", "n de m gols" por time e a tecla "Ir para a Resenha"; membro que não jogou vê o placar e "Ver o jogo" | Playwright |
| C43 | rodada da vez em `IN_PROGRESS` | abre o início | título "Em jogo" e card com o placar (ou "PLACAR NÃO LANÇADO") e "Ir para o jogo", no lugar da presença (que já travou) | Playwright |

## Técnico

### Contrato
Schemas em `packages/shared/src/match.ts` (parte do PR #32, refeita), exportados no `index.ts`. Primeiro commit da
branch `-back` (com os acréscimos de domínio que o contrato importa: `POST_MATCH`, `ADMIN_ONLY_IN_MATCH`,
`MATCH_RESULTS`, para compilar).

| Método | Rota (sob `/api/groups/:groupId/rounds/:roundId/match`) | Quem pode | Request | Response | Erros |
|---|---|---|---|---|---|
| `GET` | `/` | membro | — | `MatchView` | 404 |
| `POST` | `/start` | admin | — | `MatchView` | 403; 404; 409 `RoundTransitionError` |
| `PUT` | `/score` | admin | `SetMatchScoreInput` | `MatchView` | 400 validação; 403 `NOT_ADMIN`; 404; 409 `ScoreEntryError` |
| `POST` | `/finish` | admin | `SetMatchScoreInput` | `MatchView` | 400; 403; 404; 409 `ScoreEntryError` / `RoundTransitionError` |
| `POST` | `/open-voting` | admin | — | `MatchView` | 403; 404; 409 `RoundTransitionError` |
| `POST` | `/events` | membro | `LaunchMatchEventInput` | `MatchView` | 400; 403 `NOT_OWN_EVENT` / `ADMIN_ONLY_IN_MATCH`; 404; 409 outros `MatchEventError` |
| `DELETE` | `/events/:eventId` | membro | — | `MatchView` | 403 `NOT_OWN_EVENT` / `ADMIN_ONLY_IN_MATCH`; 404; 409 `ROUND_NOT_OPEN` |

Todo erro 4xx de regra vem como `{ code, message }`, com a `message` dos labels do shared. Permissão (dono do
lance, admin) → 403; momento e números → 409. `finish` grava placar e status numa transação: valida o placar
(`validateScoreEntry`) e depois a transição com esse placar.

```ts
// packages/shared/src/domain.ts (acréscimos)
ROUND_STATUS_LABELS.POST_MATCH = 'Resenha pós-jogo';
MATCH_EVENT_ERROR_LABELS.ADMIN_ONLY_IN_MATCH = 'Durante o jogo só o admin lança. Seus lances entram na Resenha';
MATCH_EVENT_ERROR_LABELS.ROUND_NOT_OPEN = 'Só dá para lançar durante o jogo ou na Resenha';
SCORE_ENTRY_ERROR_LABELS.ROUND_NOT_OPEN = 'Só dá para lançar o placar durante o jogo ou na Resenha';
export const MATCH_RESULT_LABELS: Record<MatchResult, string>; // WIN 'YOU WIN', LOSS 'YOU LOSE', DRAW 'EMPATE'
export const matchResultSchema = z.enum(MATCH_RESULTS);

// packages/shared/src/match.ts
setMatchScoreSchema   = matchScoreSchema;
launchMatchEventSchema = z.object({ membershipId: z.string().min(1), type: matchEventTypeSchema }); // GOAL | ASSIST | OWN_GOAL

matchPlayerSchema = z.object({
  membershipId: z.string(), nickname: z.string(), photoUrl: z.string().nullable(),
  team: teamSchema, position: positionSchema, isReserve: z.boolean(),
});

matchEventSchema = z.object({
  id: z.string(),
  type: matchEventTypeSchema,
  membershipId: z.string(), nickname: z.string(), photoUrl: z.string().nullable(),
  playerTeam: teamSchema,   // time de quem fez (anel do avatar)
  team: teamSchema,         // time que ganhou o lance: OWN_GOAL = adversário; é a lista onde aparece
  createdByNickname: z.string(),
  createdAt: z.iso.datetime(),
  canRemove: z.boolean(),   // validateMatchEventRemoval para quem pede
});

teamTallySchema = z.object({ WHITE: z.number().int(), BLACK: z.number().int() });

matchPermissionsSchema = z.object({
  start: z.boolean(),       // admin e TEAMS_PUBLISHED (mesmo com errors, para mostrar o motivo)
  setScore: z.boolean(),    // admin e IN_PROGRESS | POST_MATCH
  finish: z.boolean(),      // admin e IN_PROGRESS
  openVoting: z.boolean(),  // admin e POST_MATCH
  launchOwn: z.boolean(),   // pode lançar lance próprio agora (jogou e o domínio deixa o status/papel)
  launchAny: z.boolean(),   // admin e IN_PROGRESS | POST_MATCH
});

matchViewSchema = z.object({
  roundId: z.string(),
  number: z.number().int(),
  scheduledAt: z.iso.datetime(),
  status: roundStatusSchema,
  score: matchScoreSchema.nullable(),
  tally: z.object({ goals: teamTallySchema, assists: teamTallySchema }), // tallyMatchEvents
  players: z.array(matchPlayerSchema),     // vazio sem times
  events: z.array(matchEventSchema),       // ordem de lançamento
  me: z.object({
    membershipId: z.string(),
    isAdmin: z.boolean(),
    team: teamSchema.nullable(),           // null = não jogou
    result: matchResultSchema.nullable(),  // POST_MATCH+ com placar e jogou; senão null
  }),
  // O que impede o próximo passo do admin: em TEAMS_PUBLISHED, → IN_PROGRESS; em IN_PROGRESS, [] (o placar vem no
  // finish); em POST_MATCH, → VOTING. Só admin; [] para jogador e nos outros status.
  errors: z.array(z.enum(ROUND_TRANSITION_ERRORS)),
  permissions: matchPermissionsSchema,
});
// tipos: SetMatchScoreInput, LaunchMatchEventInput, MatchPlayer, MatchEventItem, MatchPermissions, MatchView
```

### Banco (`schema.prisma`)
- `RoundStatus` ganha `POST_MATCH` (entre `IN_PROGRESS` e `VOTING`); `domain-enums.spec.ts` segue garantindo igual
  ao domain.
- `Round.votingOpenedAt DateTime?`: quando entrou em `VOTING` (o `openedAt` da votação). Gravado no `open-voting`.
- Uma migration (`post_match_e_voting_opened_at`).

### Domínio
- `ROUND_STATUSES` com `POST_MATCH`; `ROUND_TRANSITIONS` como no ciclo acima; `validateRoundTransition(→ POST_MATCH)`
  = `SCORE_MISSING` / `INVALID_SCORE`.
- `MATCH_EVENT_ERRORS` ganha `'ADMIN_ONLY_IN_MATCH'`; `validateMatchEvent` e `validateMatchEventRemoval` devolvem
  só ele para jogador comum em `IN_PROGRESS`.
- `isMatchOpen(status)` = `IN_PROGRESS` | `POST_MATCH`.
- `MATCH_RESULTS = ['WIN', 'LOSS', 'DRAW']`, `matchResult(score: MatchScore, team: Team): MatchResult`.
- `pickCurrentRound`: `POST_MATCH` junto com `IN_PROGRESS`. `validateAttendanceChange`, `isRoundDeletable` e
  `isRoundEditable`: `POST_MATCH` como `IN_PROGRESS`.
- Seed: cenário novo `resenha`; no `em-jogo`, lances lançados pelo admin; histórico passando por `POST_MATCH`.

### Tela
- **Jogo** `/rodadas/:roundId/jogo` (o detalhe da rodada já aponta para lá em `IN_PROGRESS`+; admin em
  `TEAMS_PUBLISHED` ganha "Ir para o jogo", jogador segue em "Ver times"). Status novo nos labels e no `nextStep`.
- Peças da #32 a refazer no padrão de `features/rounds` e `features/lineup`: placar com corte diagonal (assinatura
  1, dígitos pixel), lista de lances por time com "n de m gols" (de `tally`/`score`), seletor de jogador agrupado
  por time, gaveta de confirmação, aviso com Desfazer, `member-avatar` com anel do time.
- Card YOU WIN / YOU LOSE / EMPATE: grande momento no padrão do VS (`vs-board.tsx`, `vs-seen.ts`): CSS `steps()` e
  SVG pixel, `aria-hidden` na animação, quadro final anunciado ("Você venceu 3 a 2"), foco no conteúdo depois.
  Cor nunca é o único sinal.
- **Início** (`pages/rounds/home.tsx`): com a rodada da vez em `IN_PROGRESS` ou `POST_MATCH`, troca o card de presença
  pelo card do jogo (dados do `GET .../match`: `score`, `tally`, `me`, `permissions`). Textos conforme `me.team` e
  `me.isAdmin`; o que pode fazer vem de `permissions`.
- Nada de regra no front: o que pode vem de `permissions`, `canRemove` e `errors`; contagens de `tally`. Sem
  dependência nova.

### Decisões
- Etapa nova `POST_MATCH` ("Resenha pós-jogo") — o dono quer o admin finalizando com o placar e a turma conferindo
  os próprios lances antes da votação.
- Durante o jogo só o admin lança — a resenha é na hora, com o admin; os jogadores entram depois.
- Sem botão de "confirmar meus lances": o jogador lança e apaga; o admin abre a votação quando os gols batem.
- Placar e lances congelam ao abrir a votação — quem vota vê números que não mudam.
- `votingOpenedAt` entra agora — abrir a votação é desta fatia (dono); a fatia `votacao` usa o campo.
- Gol contra aparece na lista do time que ganhou o gol — a conta "n de m gols" fecha olhando só a lista do time.
- `pickCurrentRound` trata `POST_MATCH` como em jogo, e o início mostra o card "Hora da Resenha" chamando o jogador
  para lançar os próprios lances (dono).
- `finish` recebe o placar no corpo — "finalizar informando o placar final" é um passo só para o admin.

## Fora do escopo
- Tela de votar, notas, Craque e Perna de Pau, fechar a votação (`votacao`, #6).
- Histórico e detalhe de rodadas passadas (`historico`, #4).
- Voltar da Resenha para em jogo; dois admins ao mesmo tempo (o último vence).
- Som no card de resultado.
- Cronômetro de rodízio dos reservas: fatia própria `rodizio-reservas` (3b), logo depois desta (dono).

## Perguntas respondidas pelo dono
- Que etapas entram? → Começar e encerrar (abrir a votação), gravando `votingOpenedAt`.
- Gol contra pela tela? → Igual a gol e assistência.
- Gol contra na lista? → No time que ganhou o gol.
- Fluxo do placar? → Em jogo só o admin; finaliza com o placar; Resenha para os jogadores conferirem limitados pelo
  placar; números batendo, o admin abre a votação.
- Etapa nova? → Sim, "Resenha pós-jogo".
- Card YOU WIN / YOU LOSE? → Entra, uma vez por jogador.
- Jogador confirma? → Não, só lança e apaga os próprios.
- Na votação? → Congela.
- A Resenha aparece no início? → Sim, com um card "Hora da Resenha" que leva o jogador a lançar os gols e assistências.
- Cronômetro dos reservas? → Fatia própria, logo depois desta.

## Volta 2: placar primeiro, lances por jogador e cards de grande momento

Pedido do dono depois de testar (25 out 2026). Muda regra de domínio, um pouco do contrato e bastante da tela.

### Regras que mudam
- **Placar primeiro, lances depois:** em `IN_PROGRESS` ninguém lança lance, nem o admin. A tela do admin em jogo só
  tem "Finalizar jogo" com o placar. Todos os lances entram na **Resenha**, com o placar como teto.
  `isMatchOpen` (lances) = só `POST_MATCH`; placar = `IN_PROGRESS` (via finish) e `POST_MATCH`. Lance em
  `IN_PROGRESS` → `ROUND_NOT_OPEN` ("Só dá para lançar e apagar lances na Resenha"). O código `ADMIN_ONLY_IN_MATCH`
  sai do domínio e do shared.
- **Placar do admin nunca é barrado pelos lances:** sai `SCORE_BELOW_GOALS`. Se o admin baixar o placar abaixo dos
  gols já lançados, a abertura da votação acusa (`GOALS_MISMATCH`) até ele acertar.
- **Assistência sem validação:** saem `ASSISTS_EXCEED_SCORE`, `SCORE_BELOW_ASSISTS` e `TOO_MANY_ASSISTS`.
  Assistência é solta e não trava nada.
- O gol continua limitado pelo placar (`GOALS_EXCEED_SCORE`, gol contra contando para o adversário) e abrir a
  votação continua exigindo gols = placar.
- Etapa na tela: **"Resenha"** (`ROUND_STATUS_LABELS.POST_MATCH`).
- 403 de `start`, `finish` e `open-voting` também em `{ code: 'NOT_ADMIN', message }`.
- Seed `em-jogo`: placar nulo e **sem lances**. `resenha`: placar 3x2 e alguns lances (sem assistência limitada).

### Cenários da volta 2 (substituem os que contradizem: C6, C10, C17, C18, C19 parcial, C20, C21 de assistência, C31–C33, C38)

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C44 | `IN_PROGRESS`, admin ou jogador | `validateMatchEvent` / `POST .../events` | `ROUND_NOT_OPEN` / 409 `ROUND_NOT_OPEN` | unitário + integração |
| C45 | `IN_PROGRESS` ou `POST_MATCH` com gols lançados acima do novo placar | admin `finish` / `PUT score` com placar menor | 200, grava; `errors` da Resenha passa a ter `GOALS_MISMATCH` | unitário + integração |
| C46 | `POST_MATCH`, placar 1x0 | lançar 3 assistências do Branco | 200 nas três; abrir votação com 1 gol do Branco passa | unitário + integração |
| C47 | jogador comum | `start` / `finish` / `open-voting` | 403 `{ code: 'NOT_ADMIN', message }` | integração |
| C48 | seed `em-jogo` | rodar | `IN_PROGRESS`, placar nulo, nenhum lance | integração |
| C49 | admin em jogo | abre `/rodadas/:id/jogo` | placar grande, "Finalizar jogo" e o texto "Os lances entram na Resenha"; sem teclas de lance | Playwright |
| C50 | admin finaliza | gaveta com −/+ começando em 0x0 | grava qualquer placar válido, sem aviso de gols | Playwright |
| C51 | admin na Resenha | olhar a tela | seletor Branco/Preto com "BRANCO n DE m GOLS"; uma linha por jogador do time (avatar com anel, apelido, posição) com **GOL [−] n [+]** e **AST [−] n [+]**; "⋯" na linha abre "Gol contra" (lançar/apagar) | Playwright |
| C52 | admin na linha do Bruninho | toca no + de Gol / no − de Gol | lança um gol dele (o número sobe com animação curta) / apaga o último gol dele; passando do placar, o + fica desabilitado ou avisa com o texto do shared | Playwright |
| C53 | assistências | + de Assist várias vezes | sobe sem limite | Playwright |
| C54 | aviso de lance | lançar e apagar assistência | "Assistência de Diegão lançada" / "apagada" (feminino); gol e gol contra no masculino | unitário (texto) + Playwright |
| C55 | qualquer gaveta | fechar (confirmar, cancelar, tocar fora) | some em ≤ 150 ms; abrir ≤ 200 ms | Playwright |
| C56 | cards de grande momento: placar do jogo, YOU WIN / YOU LOSE / EMPATE, "Em jogo" e "Hora da Resenha" no início | abrir | **borda grossa** (contorno 3px `--color-border-strong` + sombra dura `--shadow-float`), entrada animada em degraus (≤ 400 ms; com reduzir movimento, só fade); o YOU WIN com mais festa: confete/estrelas pixel, dígitos que batem, faixa do time | Playwright |
| C57 | placar mudou (finish, −/+) | olhar o placar | o dígito que mudou "bate" (escala em degraus, 150–250 ms) | Playwright |
| C58 | jogador na Resenha | olhar | igual à volta 1 (está bom), com os cards novos e os textos no feminino | Playwright |

### Contrato
- `MATCH_EVENT_ERRORS` sem `ASSISTS_EXCEED_SCORE` e `ADMIN_ONLY_IN_MATCH`; `SCORE_ENTRY_ERRORS` sem
  `SCORE_BELOW_GOALS` e `SCORE_BELOW_ASSISTS`; `ROUND_TRANSITION_ERRORS` sem `TOO_MANY_ASSISTS`. Labels juntos.
- `permissions.launchAny` = admin e `POST_MATCH`; `launchOwn` = jogou e `POST_MATCH`.
- `MatchView` não muda de forma: a contagem por jogador sai de `events` (apresentação; o − apaga o último lance
  daquele tipo do jogador com `canRemove`).
- Exportar do shared os tipos `MatchScore` e `MatchResult` (furo da volta 1).

### Visual (critérios para o dev-front)
- Todo card de jogo é grande momento: contorno grosso e sombra dura, nunca card chapado. Ver folha (`Partida`,
  `Grandes momentos`) e `DESIGN.md` (Forma, Movimento).
- "RESENHA" não cola no dígito do Branco; nada rente à barra de abas no fim da rolagem.
- Movimento em degraus (`steps()`), 150–250 ms nas microinterações, grandes momentos até 2 s com Pular.

## QA
**1 volta, `VEREDITO: APROVADO`** (25 out 2026). Lint, typecheck, testes (domínio 293, API 207 de integração,
web 151) e build verdes com back e front juntos; na raiz do `feature/placar-e-lances`, depois do merge, de novo
verdes. API por curl com admin, jogador do Branco e do Preto, membro que não jogou, admin de outro grupo e membro
inativo; respostas 200 conferidas com `matchViewSchema`. Tela no Playwright a 390px como admin, jogador e quem não
jogou; console sem erros de JS no fluxo real.

| Cenário | Resultado | Evidência |
|---|---|---|
| C1–C5 | OK | `status.test.ts` (Resenha exige placar, não pula para a votação, gols batendo para votar, gol contra) |
| C6–C10 | OK | `events.test.ts` (só admin em jogo, próprios na Resenha, gol contra passando do placar, congela na votação, placar do admin); curl `SCORE_BELOW_GOALS` |
| C11–C13 | OK | `match.test.ts`, `current.test.ts`, `attendance.test.ts`; curl na Resenha: `ATTENDANCE_CLOSED`, `ROUND_NOT_EDITABLE`, `ROUND_NOT_DELETABLE` |
| C14–C21 | OK | `match.spec.ts`; curl: view com `team` do gol contra no adversário e `canRemove` por pessoa; start, `ATTENDANCE_MISMATCH`, lances do admin, 403 `ADMIN_ONLY_IN_MATCH`, finish e `SCORE_BELOW_GOALS`, regras do jogador na Resenha |
| C22–C28 | OK | `match.spec.ts`; curl: open-voting com e sem gols batendo e `votingOpenedAt`, `ROUND_NOT_OPEN` na votação, 403 do jogador, `INVALID_TRANSITION` fora de ordem, 404 entre grupos/inativo/lance de outra rodada, `me.result` |
| C29 | OK | `seed.spec.ts`; banco: em-jogo 2x1 só do admin e placar nulo, resenha 3x2 com gols faltando e gol contra, passadas com `votingOpenedAt` |
| C30–C34 | OK | Playwright: começar (e motivo com tecla desabilitada), placar não lançado, seletor e gol contra na lista do time beneficiado, finalizar abaixo dos gols e para a Resenha, jogador só leitura em jogo |
| C35–C36 | OK | YOU WIN / YOU LOSE com placar, Pular 100x44, foco em "Você venceu 3 a 2", não repete, storage quebrado não quebra, quem não jogou não vê; reduzir movimento só com fade |
| C37–C40 | OK | jogador lança/apaga os próprios na Resenha; admin corrige placar e abre a votação; tela congela; esqueleto, erro com "Tentar de novo", não encontrada, "O jogo ainda não começou" |
| C41–C43 | OK | início: "Hora da Resenha" (jogador, admin e quem não jogou) e "Em jogo", sem o card de presença |

Pontos menores, sem reprovar: 403 de `start`/`finish`/`open-voting` vem do guard, sem `{ code, message }` (o front
mostra um texto genérico); lançar lance e placar sem transação (dois toques juntos podem passar do placar; concorrência
fora do escopo); aviso "Assistência ... apagado/lançado" sem concordar no feminino; na rodada não encontrada, o
voltar aponta para a própria rodada; "já vi o resultado" é por rodada no navegador, não por usuário; rótulo
"RESENHA PÓS-JOGO" colado no dígito do Branco e último motivo rente à barra de abas.
