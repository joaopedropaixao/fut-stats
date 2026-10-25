# `placar-e-lances`

> Spec de fatia da Trilha. Fluxo da equipe: `docs/specs/2026-10-24-equipe-design.md`.

| | |
|---|---|
| **Fatia** | `placar-e-lances` (#3 da Trilha) |
| **Modo** | Par |
| **Parte de** | PR #32 (fechar), branch `origin/feature/tela-placar-e-scouts` |
| **Status** | rascunho |

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
- `pickCurrentRound` trata `POST_MATCH` como em jogo — senão a rodada some do início na Resenha (decisão do TPL, confirmar no portão).
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
- Cronômetro dos reservas? → Fatia própria, logo depois desta.

## QA
<Preenchido no fim.>
