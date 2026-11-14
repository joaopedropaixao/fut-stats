# `votacao`

> Spec de fatia da Trilha, escrito pelo líder da v1 (`docs/specs/2026-11-14-autonomia-v1.md`).
> Fluxo da equipe: `docs/specs/2026-10-24-equipe-design.md`.
> Dúvidas respondidas pelo dono em lote: `docs/specs/perguntas-v1.md`.

| | |
|---|---|
| **Fatia** | `votacao` (onda 3) |
| **Modo** | Par |
| **Parte de** | — |
| **Status** | aprovado em 2026-11-14 |
| **Base** | develop @1021769 |
| **Depende de** | perfil-jogador, historico |
| **Toca em** | apps/api/prisma/schema.prisma, packages/domain/src/round, packages/domain/src/round-score, packages/shared/src/voting.ts, packages/shared/src/round.ts, packages/shared/src/history.ts, packages/shared/src/domain.ts, apps/api/src/voting, apps/api/src/match, apps/api/src/rounds, apps/api/src/history, apps/api/src/seed, apps/api/src/config/env.ts, .env.example, apps/web/src/features/voting, apps/web/src/pages/voting, apps/web/src/pages/rounds/home.tsx, apps/web/src/pages/rounds/detail.tsx, apps/web/src/pages/historico, apps/web/src/features/history, apps/web/src/router.tsx |

## Produto

### Objetivo
Depois da Resenha, quem jogou dá nota a todos os outros, escolhe o Craque e o Perna de Pau e envia tudo de uma vez.
Dá para mudar até a votação fechar. Ela fecha sozinha (todo mundo votou ou o prazo acabou) ou quando o admin
encerra. Fechou, sai o **resultado da rodada**: Craque, Perna de Pau e a nota de cada um, que também passam a
aparecer no Histórico. A abertura do pacote do Craque (grande momento) é da fatia `pacote-do-craque`.

### Quem usa
- **Quem jogou a rodada** (titular ou reserva, goleiro incluso): vota e edita o voto enquanto a votação está aberta.
- **Membro que não jogou:** vê que há votação e quantos já votaram; não vota. Vê o resultado.
- **Admin:** além de votar (se jogou), encerra a votação antes do prazo e vê **quem ainda não votou**.
- **Usuário de outro grupo, ou membro inativo:** 404 em tudo.

### Regras de domínio
Já decididas e implementadas no domain
([CONTEXT.md › Nota da rodada, Craque e Perna de Pau](../../CONTEXT.md#nota-da-rodada-craque-e-perna-de-pau-roundscore-) e
[› Rodada, placar e scouts](../../CONTEXT.md#rodada-placar-e-scouts-validateroundtransition--validatematchevent--shouldclosevoting-)):
- Só quem jogou vota; ninguém vota em si; quem vota avalia **todos** e manda o pacote inteiro (notas + Craque +
  Perna de Pau, em jogadores diferentes): `validateRoundVote`.
- Nota de 0 a 10, de 0,5 em 0,5. Nota da rodada = média aparada com 4 notas ou mais; média simples com 3 ou menos;
  sem notas, `null`: `roundScore`.
- Craque e Perna de Pau: mais votado leva; empate vai para a maior (ou menor) nota da rodada; se a nota empatar,
  todos levam: `tallyAwards` com `ROUND_SCORE`.
- O voto pode ser alterado enquanto a votação está aberta (`isVotingOpen`). Fecha quando todos votaram
  (`ALL_VOTED`) ou no prazo (`DEADLINE_PASSED`), ou quando o admin encerra. `CLOSED` é definitivo.
- Votos são anônimos: ninguém, nem o admin, vê quem votou em quem. A média é pública.

Novas nesta fatia:
- **Prazo**: `Group.votingDeadlineHours` passa de 48 para **24 horas** (contadas de quando o admin abriu a
  votação). O valor segue por grupo no banco; tela para mudar fica para depois.
- **"Todos votaram" conta só quem ainda está ativo.** Quem jogou e foi desativado continua recebendo nota, mas não
  segura a votação aberta (ele não consegue mais entrar no app).
- **Quem falta votar**: todos veem só a contagem ("9 de 16 já votaram"); o admin vê também os nomes de quem
  falta, para cobrar no grupo.
- **Apuração gravada ao fechar:** no mesmo passo que leva a rodada a `CLOSED`, a API calcula a nota de cada um e os
  prêmios e grava o resultado. Dali em diante o resultado não muda, mesmo que um parâmetro mude no futuro.
- **Fechamento automático:** vale o que acontecer primeiro: o último voto (fecha na hora), um relógio da API (a
  cada minuto) ou alguém abrir o app depois do prazo. Voto que chega depois do prazo é recusado mesmo que a rodada
  ainda não tenha sido fechada.
- **Resultado em destaque:** o início mostra "O resultado saiu" por 7 dias depois do fechamento
  (`RESULT_HIGHLIGHT_DAYS`), ou até a pessoa abrir.
- **Sem votos:** a rodada fecha no prazo sem nota e sem prêmio para ninguém (votar é opcional).

### Cenários
Cada cenário tem um id. Os testes levam o id no nome.

**Domínio**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C1 | 16 jogaram; 6 votos válidos | `roundResults(votes, playedIds)` | cada jogador com `score` = `roundScore` das notas que recebeu (aparada com 4+) e `ratingsCount`; `mvpIds` e `flopIds` do `tallyAwards` com desempate pela nota | unitário |
| C2 | 3 votos | `roundResults` | média simples (sem aparar) | unitário |
| C3 | nenhum voto | `roundResults` | todos com `score: null`, `ratingsCount: 0`; `mvpIds` e `flopIds` vazios | unitário |
| C4 | empate de votos para Craque, notas diferentes; notas iguais | `roundResults` | leva o de maior nota; os dois levam | unitário |
| C5 | um voto inválido no meio (faltou nota, votou em si) | `roundResults` | `{ ok: false, errors }` com o problema; não calcula pela metade | unitário |
| C6 | `VOTING` com voto de todos os ativos e um jogador desativado sem voto | `votingCloseReason` com `playedIds` = só os ativos | `ALL_VOTED` | unitário |
| C7 | rodadas `VOTING` (duas), `CLOSED` e `SCHEDULED` | `pickVotingRound` | a `VOTING` de data mais recente; sem nenhuma, `null` | unitário |
| C8 | rodada fechada há 6 dias e outra há 8 | `pickLatestResult(rounds, now)` | a de 6 dias; com só a de 8, `null`; entre duas dentro do prazo, a que fechou por último | unitário |
| C9 | `VOTING_END_REASONS` | conferir | `ALL_VOTED`, `DEADLINE_PASSED`, `ADMIN_CLOSED`, igual ao enum do banco | unitário (`domain-enums.spec.ts`) |

**API: votar**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C10 | rodada `VOTING`, quem pede jogou e não votou | `GET .../voting` | `VotingView`: `players` (todos que jogaram, com `avatar`, time e posição), `progress`, `deadline` = `votingOpenedAt` + prazo do grupo, `serverTime`, `me.vote: null`, `permissions.vote: true` | integração |
| C11 | idem | `PUT .../voting/vote` com nota para os 15 outros + Craque + Perna de Pau | 200; `me.vote` devolve o que foi enviado; `progress.voted` sobe 1 | integração |
| C12 | já votou | `PUT` de novo com notas e prêmios diferentes | 200; substitui (continua 1 voto dele; nenhuma nota antiga sobra) | integração |
| C13 | pacote faltando uma nota; com nota para si; nota 7,3; alvo que não jogou; Craque = Perna de Pau; alvo repetido | `PUT` | 400 `{ code, message, issues }` com o código do domain (`MISSING_RATING`, `SELF_VOTE`, `INVALID_STEP`, `TARGET_DID_NOT_PLAY`, `SAME_PLAYER_BOTH`, `DUPLICATE_TARGET`) e o texto do shared; nada gravado | integração |
| C14 | membro que não jogou | `PUT` | 403 `VOTER_DID_NOT_PLAY`; `GET` dele traz `permissions.vote: false` e `me.played: false` | integração |
| C15 | rodada antes de `VOTING` | `GET` / `PUT` | `GET` 200 com `status` e `permissions.vote: false`; `PUT` 409 `VOTING_NOT_OPEN` | integração |
| C16 | rodada `VOTING` com o prazo vencido (relógio injetado) | `PUT` | 409 `VOTING_CLOSED`; nada gravado; a rodada passa a `CLOSED` | integração |
| C17 | o último ativo que faltava vota | `PUT` | 200 com `status: 'CLOSED'`, `closeReason: 'ALL_VOTED'`; resultado gravado na mesma transação | integração |
| C18 | dois `PUT` do mesmo votante ao mesmo tempo | `Promise.all` | os dois 200 e um voto só no banco (o último vence); nunca 500 | integração |
| C19 | o último voto e o `close` do admin ao mesmo tempo | `Promise.all` | a rodada fecha uma vez só (um motivo gravado); o outro pedido leva 200 já fechada ou 409 | integração |
| C20 | qualquer membro | `GET .../voting` | nunca traz voto de outra pessoa; `pending` vem `null` para jogador e com a lista de quem falta para o admin | integração |

**API: fechar e resultado**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C21 | admin, `VOTING` com 6 votos | `POST .../voting/close` | 200 `CLOSED`, `closeReason: 'ADMIN_CLOSED'`, `closedAt`; `TeamPlayer` de cada um com `roundScore`, `ratingsCount`, `isMvp`, `isFlop` iguais ao `roundResults` | integração |
| C22 | jogador comum | `close` | 403 `NOT_ADMIN` | integração |
| C23 | rodada fora de `VOTING` | `close` | 409 `INVALID_TRANSITION` | integração |
| C24 | `VOTING` com prazo vencido | o relógio da API roda (`closeDueVotings(now)`) | fecha com `DEADLINE_PASSED`; rodadas de outros grupos também; as que ainda têm prazo, não | integração |
| C25 | `VOTING` com prazo vencido | `GET /groups/:groupId/rounds` (ou `GET .../voting`) | a resposta já vem com a rodada `CLOSED` | integração |
| C26 | `CLOSED` | `GET .../voting/result` | `RoundResult`: placar, `mvps`, `flops`, `players` em ordem de nota (sem nota por último, depois apelido), com `rank` da rodada (empate divide), gols, assistências e gols contra de cada um; `me` diz quem sou e se joguei (a minha nota e posição estão na minha linha de `players`) | integração |
| C27 | `VOTING` | `GET .../result` | 409 `RESULT_NOT_READY` | integração |
| C28 | fechou sem voto nenhum | `GET .../result` | todos sem nota, `mvps` e `flops` vazios, `votes.voted: 0` | integração |
| C29 | `CLOSED` | `PUT .../vote`, `close` | 409 `VOTING_CLOSED` / `INVALID_TRANSITION`; resultado intocado | integração |
| C30 | grupo com uma `VOTING` e uma fechada ontem | `GET /groups/:groupId/rounds` | `votingId` e `lastResult` preenchidos; 8 dias depois, `lastResult: null` | integração |
| C31 | histórico com partida `CLOSED` | `GET .../history` | o item traz `mvps` (apelido e `avatar`); antes de fechar, lista vazia | integração |
| C32 | rodada de outro grupo, não membro, membro inativo | qualquer rota | 404; nada muda | integração |
| C33 | seed `--cenario=votacao` e `--cenario=encerrada` | rodar | `votacao`: rodada em `VOTING` aberta agora, com parte dos votos e o usuário de dev sem votar; `encerrada`: última rodada `CLOSED` hoje, com resultado; rodadas passadas com votos e resultado gravado | integração (`seed.spec.ts`) |

**Tela: início e entrada** (390 px)

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C34 | votação aberta, joguei e não votei | abrir o início | card de grande momento **"VOTAÇÃO ABERTA"** (ícone de urna, cor de atenção, o tipo escrito): "RODADA 12", selo "FECHA EM 5 H", medidor "9 DE 16 JÁ VOTARAM" e a tecla amarela **"Dar minhas notas"**. Fica acima do card da próxima rodada | Playwright |
| C35 | já votei | início | o mesmo card com "VOCÊ JÁ VOTOU ✓" e a tecla de contorno "Ver meus votos" | Playwright |
| C36 | não joguei | início | o card com "Só quem jogou vota. O resultado sai quando fechar.", sem tecla | Playwright |
| C37 | detalhe da rodada em `VOTING`; tela do jogo em `VOTING` | olhar | próximo passo "Ir para a votação" → `/rodadas/:roundId/votar` | Playwright |

**Tela: votar** (`/rodadas/:roundId/votar`)

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C38 | joguei, sem voto | abrir | primeiro jogador (os do meu time primeiro, depois o adversário; em cada time, do goleiro ao atacante e reservas). Card da folha (Card/Nota): "1 DE 15", rosto grande, apelido, "Zagueiro · Preto", nota vazia ("–") e "Seu voto é anônimo. Só a média aparece." | Playwright |
| C39 | nota vazia | toca em + ou − ; toca na régua | a nota começa em 6,0 e anda de 0,5 em 0,5 (o dígito "bate"); tocar num ponto da régua pula para aquele valor; arrastar é só atalho. Para em 0 e em 10. Uma frase curta acompanha a faixa da nota | Playwright |
| C40 | nota vazia | olhar "Próximo jogador" | desabilitada com "Dê uma nota para continuar" (não dá para pular) | Playwright |
| C41 | deu a nota | "Próximo jogador" / "Anterior" | anda entre os jogadores mantendo as notas; no último, a tecla vira "Revisar" | Playwright |
| C42 | revisão (Card/Revisão) | olhar | todos os 15 com a nota; tocar numa linha volta àquele jogador e, ao confirmar, retorna à revisão. Tecla "Continuar para o voto" | Playwright |
| C43 | passo 1 de 2 | escolher o Craque | lista com rosto, apelido e o time escrito; o escolhido ganha contorno grosso, selo com ícone e a palavra "ESCOLHIDO"; eu não apareço; "Próximo" só habilita com escolha | Playwright |
| C44 | passo 2 de 2 | escolher o Perna de Pau | o meu Craque aparece travado com "JÁ É SEU CRAQUE"; tecla "Enviar votos" | Playwright |
| C45 | enviar | — | **"VOTOS ENVIADOS!"** (Fim de jogo da folha): o meu bonequinho comemorando com o pulinho de 2 quadros, "O resultado sai sáb às 21h, ou antes, se todo mundo votar", medidor, contagem (horas e minutos) e as teclas "Editar votos" e "Voltar para o início" | Playwright |
| C46 | no meio da votação | fecha o app e abre de novo | volta no jogador em que parou, com as notas já dadas (rascunho no aparelho, por rodada e por jogador) | Playwright |
| C47 | já votei | abrir `/votar` | card **"SEUS VOTOS"** (Card/Seus votos/Edição): Craque, Perna de Pau e "15 notas enviadas", cada um com lápis de 44 × 44; "FECHA EM 5 H"; medidor | Playwright |
| C48 | editando | muda uma nota e o Craque; envia | "Votos atualizados"; o card mostra o novo | Playwright |
| C49 | o prazo acaba com a tela aberta | tenta enviar | tela "A VOTAÇÃO FECHOU" (folha: Erro/Votação fechou) com "Ver o resultado" e "Voltar para o início"; o rascunho é descartado | Playwright |
| C50 | não joguei | abrir `/votar` | medidor, prazo e "Só quem jogou vota"; sem fluxo de notas | Playwright |
| C51 | admin | abrir `/votar` | além do dele, bloco "Faltam votar · 7" com rostos e apelidos, e a tecla de contorno "Encerrar votação" | Playwright |
| C52 | admin | "Encerrar votação" | gaveta da folha ("Os votos enviados até agora valem, e ninguém mais poderá votar nesta rodada."); Encerrar leva ao resultado | Playwright |
| C53 | outra pessoa vota com a minha tela aberta | esperar | o medidor atualiza em até 15 s e ao voltar para a aba | Playwright |
| C54 | erro de rede ao enviar | enviar | aviso de erro com "Tentar de novo"; nada se perde | Playwright |

**Tela: resultado** (`/rodadas/:roundId/resultado`)

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C55 | rodada fechada há pouco | abrir o início | card de grande momento **"O RESULTADO SAIU"** (ouro, ícone de pacote, o tipo escrito): "RODADA 12 · NOTAS FECHADAS. QUEM FOI O CRAQUE?" e a tecla amarela "Ver resultado". Depois de aberto uma vez, vira uma linha simples | Playwright |
| C56 | resultado | abrir | **carta do Craque** (folha: Carta/Craque, ouro, só ela inclinada): bonequinho, apelido, "CRAQUE · RODADA 12", nota em dígitos pixel. Grande momento com entrada em degraus | Playwright |
| C57 | resultado | olhar | card do **Perna de Pau** em madeira (`--color-flop`), com selo e ícone, sem brilho; tom de zoeira ("Hoje não deu") | Playwright |
| C58 | joguei | olhar | card **"SUA NOTA"**: a nota grande, "3º DA RODADA" e "VOCÊ"; sem nota: "Ninguém te deu nota nesta rodada" | Playwright |
| C59 | resultado | olhar a tabela | todos que jogaram, em ordem de nota: posição da rodada, rosto com anel do time, apelido, nota, e "2 GOLS · 1 AST" quando tem; selos CRAQUE e PERNA DE PAU na linha; a minha linha com "VOCÊ"; quem ficou sem nota no fim, com "SEM NOTA" | Playwright |
| C60 | empate no Craque (dois levam) | olhar | duas cartas, lado a lado em 390 px e empilhadas em 320 px | Playwright |
| C61 | fechou sem votos | abrir | "Ninguém votou nesta rodada. Sem notas e sem prêmios.", com o placar | Playwright |
| C62 | rodada ainda em votação | abrir `/resultado` | "O resultado ainda não saiu" com link para a votação | Playwright |
| C63 | Histórico | lista e detalhe de partida encerrada | o card ganha a **linha do Craque** (rosto + "CRAQUE" + apelido); o detalhe ganha o bloco "Resultado" (Craque, Perna de Pau e "Ver notas") | Playwright |
| C64 | reduzir movimento | votar e ver o resultado | sem pulinho, sem degraus: troca com fade | Playwright (`emulateMedia`) |
| C65 | carregando; erro da API; rodada não encontrada | votar e resultado | esqueleto; erro com "Tentar de novo"; não encontrada com voltar. Console sem erros no fluxo real | Playwright |
| C66 | larguras 320, 375, 390, 430 px e desktop | início com os dois cards, cada passo de votar (nota, revisão, passo 1, passo 2, votos enviados, seus votos, votação fechou) e o resultado | sem rolagem horizontal, sem sobreposição, apelidos de 10 letras inteiros, alvos ≥ 44 px (lápis, stepper, linhas de escolha); no desktop, coluna centralizada. Checagem automática passa | Playwright |

## Técnico

### Contrato
Schemas em `packages/shared/src/voting.ts` (arquivo novo, exportado no `index.ts`), mais acréscimos em `round.ts` e
`history.ts`. Primeiro commit da branch `-back`, com os acréscimos de domínio que ele importa.

| Método | Rota (sob `/api/groups/:groupId/rounds/:roundId/voting`) | Quem pode | Request | Response | Erros |
|---|---|---|---|---|---|
| `GET` | `/` | membro | — | `VotingView` | 404 |
| `PUT` | `/vote` | membro que jogou | `SubmitVoteInput` | `VotingView` | 400 validação / voto inválido (`{ code, message, issues }`); 403 `VOTER_DID_NOT_PLAY`; 404; 409 `VOTING_NOT_OPEN` / `VOTING_CLOSED` |
| `POST` | `/close` | admin | — | `VotingView` | 403 `NOT_ADMIN`; 404; 409 `RoundTransitionError` |
| `GET` | `/result` | membro | — | `RoundResult` | 404; 409 `RESULT_NOT_READY` |

Erro de regra vem como `{ code, message }`. Quem pode → 403; momento → 409; conteúdo do voto → 400.

```ts
// packages/shared/src/voting.ts
export const VOTING_ERROR_LABELS = {
  VOTING_NOT_OPEN: 'A votação desta rodada ainda não abriu',
  VOTING_CLOSED: 'A votação fechou',
  RESULT_NOT_READY: 'O resultado ainda não saiu',
} as const;
export const VOTING_END_REASON_LABELS: Record<VotingEndReason, string>; // 'Todo mundo votou', 'O prazo acabou', 'O admin encerrou'

export const ratingEntrySchema = z.object({ targetId: z.string().min(1), value: ratingSchema });

/** Corpo de PUT .../voting/vote: o pacote inteiro. Enviar de novo substitui. */
export const submitVoteSchema = z.object({
  ratings: z.array(ratingEntrySchema).max(40),
  mvpId: z.string().min(1),    // Craque
  flopId: z.string().min(1),   // Perna de Pau
});

/** Quem jogou a rodada, como a votação e o resultado mostram. */
export const votingPlayerSchema = z.object({
  membershipId: z.string(), nickname: z.string(), avatar: avatarSchema,
  team: teamSchema, position: positionSchema, isReserve: z.boolean(),
});

export const votingViewSchema = z.object({
  roundId: z.string(),
  number: z.number().int(),
  scheduledAt: z.iso.datetime(),
  status: roundStatusSchema,
  openedAt: z.iso.datetime().nullable(),       // Round.votingOpenedAt
  deadline: z.iso.datetime().nullable(),       // votingDeadline(openedAt, prazo do grupo)
  closedAt: z.iso.datetime().nullable(),
  closeReason: z.enum(VOTING_END_REASONS).nullable(),
  serverTime: z.iso.datetime(),
  players: z.array(votingPlayerSchema),        // do meu time primeiro; em cada time, pela vaga e depois reservas
  progress: z.object({ voted: z.number().int(), total: z.number().int() }), // só ativos
  /** Quem ainda não votou. Só para o admin; `null` para jogador. */
  pending: z.array(votingPlayerSchema).nullable(),
  me: z.object({
    membershipId: z.string(),
    isAdmin: z.boolean(),
    played: z.boolean(),
    vote: submitVoteSchema.extend({ updatedAt: z.iso.datetime() }).nullable(),
  }),
  permissions: z.object({
    vote: z.boolean(),    // jogou e isVotingOpen
    close: z.boolean(),   // admin e VOTING
  }),
});

export const resultPlayerSchema = votingPlayerSchema.extend({
  score: z.number().nullable(),          // nota da rodada (1 casa); null = sem nota
  ratingsCount: z.number().int(),
  rank: z.number().int().positive().nullable(), // posição na rodada pela nota; null sem nota
  goals: z.number().int(), assists: z.number().int(), ownGoals: z.number().int(),
  isMvp: z.boolean(), isFlop: z.boolean(),
});

export const roundResultSchema = z.object({
  roundId: z.string(),
  number: z.number().int(),
  scheduledAt: z.iso.datetime(),
  score: matchScoreSchema,
  winner: matchWinnerSchema,
  closedAt: z.iso.datetime(),
  closeReason: z.enum(VOTING_END_REASONS),
  votes: z.object({ voted: z.number().int(), total: z.number().int() }),
  mvps: z.array(resultPlayerSchema),
  flops: z.array(resultPlayerSchema),
  players: z.array(resultPlayerSchema),
  me: z.object({ membershipId: z.string(), played: z.boolean() }),
});
// tipos: SubmitVoteInput, VotingPlayer, VotingView, ResultPlayer, RoundResult

// packages/shared/src/round.ts → roundListSchema ganha:
//   votingId: z.string().nullable()                       // pickVotingRound
//   lastResult: z.object({ roundId, number, closedAt }).nullable()  // pickLatestResult
// packages/shared/src/history.ts → historyItemSchema ganha:
//   mvps: z.array(z.object({ membershipId, nickname, avatar }))     // vazio antes de CLOSED
```

### Banco (`schema.prisma`)
- Model novo **`Vote`** (o pacote de um votante): `id`, `roundId` (→ `Round`, `onDelete: Cascade`), `voterId`
  (→ `Membership`), `mvpId` (→ `Membership`), `flopId` (→ `Membership`), `createdAt`, `updatedAt`;
  `@@unique([roundId, voterId])`.
- Model novo **`Rating`** (uma nota do pacote): `id`, `voteId` (→ `Vote`, `onDelete: Cascade`), `targetId`
  (→ `Membership`), `value Float`; `@@unique([voteId, targetId])`, `@@index([targetId])`.
- Model **`Round`**: `closedAt DateTime?` e `votingEndReason VotingEndReason?`.
- Enum novo `VotingEndReason` (`ALL_VOTED`, `DEADLINE_PASSED`, `ADMIN_CLOSED`), igual ao domain.
- Model **`TeamPlayer`** (o resultado de quem jogou, gravado ao fechar): `roundScore Float?`,
  `ratingsCount Int @default(0)`, `isMvp Boolean @default(false)`, `isFlop Boolean @default(false)`.
- Model **`Group`**: `votingDeadlineHours @default(24)`; a migration também troca 48 por 24 nos grupos que
  existem (ninguém mudou o valor: não há tela).
- **`Membership`**: só relações novas (votos dados, notas recebidas), sem coluna.
- Uma migration (`voting`).

### Domínio
- `packages/domain/src/round-score/results.ts`:
  `roundResults(votes: readonly RoundVote[], playedIds: readonly string[], options?: RoundScoreOptions & { tieBreak?: 'ROUND_SCORE' | 'SHARE' | 'NONE' }): Result<RoundResults, RoundVoteIssue>`,
  com `RoundResults = { players: Record<string, { score: number | null; ratingsCount: number }>; mvpIds: string[]; flopIds: string[] }`.
  Só compõe o que já existe (`validateRoundVote`, `parseRatings`, `roundScore`, `parseBallots`, `tallyAwards`).
- `packages/domain/src/round/voting.ts`: `VOTING_END_REASONS = [...VOTING_CLOSE_REASONS, 'ADMIN_CLOSED']`;
  `RESULT_HIGHLIGHT_DAYS = 7`.
- `packages/domain/src/round/current.ts`: `pickVotingRound(rounds)` e
  `pickLatestResult(rounds: readonly { status; closedAt: Date | null }[], now: Date, options?: { highlightDays?: number })`.
- `CONTEXT.md`: tirar "📋" de voto e fechamento, registrar `roundResults`, os dois `pick*`, o prazo de 24 h e as
  tabelas novas; corrigir a frase "Já existem como tabelas no banco".

Na API:
- Módulo novo `apps/api/src/voting` (controller, `VotingService`, `VotingCloser`).
- **Trava por rodada:** o `withRoundLock` do `MatchService` vira um provider comum
  (`apps/api/src/rounds/round-lock.service.ts`), usado por `match` e `voting`. Votar, encerrar e fechar sozinho
  rodam nele, com carregar, validar e gravar no mesmo `tx`.
- **Fechar** (um método só, `close(tx, round, reason, now)`): confere `VOTING`, `validateRoundTransition(→ CLOSED)`,
  roda `roundResults`, grava os 4 campos em cada `TeamPlayer` e `status`, `closedAt`, `votingEndReason` na rodada.
- **`VotingCloser`:** `setInterval` (com `unref`) a cada `VOTING_CLOSER_INTERVAL_MS` (padrão 60 000; `0` desliga,
  usado nos testes) que chama `closeDueVotings(now)`. `rounds.list` e `GET .../voting` chamam o mesmo método para
  o grupo antes de responder. Variável nova em `src/config/env.ts` e no `.env.example`.
- `playedIds` para "todos votaram" = `TeamPlayer` da rodada com membership ativa; para validar o voto = todos os
  `TeamPlayer`.
- Relógio injetável nos services (parâmetro `now = new Date()`, como `rounds.list`), para os testes de prazo.

### Tela
Regras de visual do documento de autonomia valem como critério. Peças da folha: seção "Dar nota e votar" inteira,
"Feed e ranking" (Aviso/Resultado, Aviso/Votação), "Grandes momentos" (Carta/Craque), "Configurações e admin"
(Gaveta/Encerrar votação, Erro/Votação fechou) e Selos.

- **Início** (`pages/rounds/home.tsx`): acima do bloco da próxima rodada, o card da votação
  (`features/voting/voting-card.tsx`) quando `votingId` existe, e o card do resultado
  (`features/voting/result-alert.tsx`) quando `lastResult` existe e ainda não foi aberto neste aparelho
  (`result-opened.ts`, no padrão de `vs-seen.ts`). Os dois são `moment-frame` com entrada em degraus. Só um
  mostra tecla amarela por vez: resultado antes de votação. A fatia `feed` reorganiza essa área depois.
- **Votar** (`pages/voting/vote-page.tsx`): um reducer puro com teste (`features/voting/vote-flow.ts`) guarda o
  passo, as notas e as escolhas; o rascunho vai para `localStorage` por `roundId` + `membershipId` (com
  `try/catch`). Passos: nota (um por jogador) → revisão → Craque → Perna de Pau → enviado.
  - **Nota:** rosto em 56 px, dígitos pixel em escala grande, stepper com teclas de 64 px (Stepper/Menos e
    Stepper/Mais), régua de 0 a 10 com marcas a cada 0,5 que aceita toque (o toque é o caminho principal; arrastar
    é atalho) e é um `input type="range"` de verdade para teclado e leitor de tela.
  - As frases por faixa de nota ficam em `features/voting/rating-phrase.ts` (texto de tela, com teste):
    0 a 3 "Dia pra esquecer"; 3,5 a 5 "Ficou devendo"; 5,5 a 6,5 "Fez o seu"; 7 a 8 "Jogou muito"; 8,5 a 9,5
    "Monstro"; 10 "Lendário".
  - **Escolhas:** linhas de 64 px; selecionada = contorno de 3 px + selo com ícone + "ESCOLHIDO".
  - **Votos enviados:** card de grande momento com o bonequinho (o meu `avatar`) e o pulinho de 2 quadros
    (`hop`, como na folha); medidor e contagem com `serverTime` corrigindo o relógio.
- **Resultado** (`pages/voting/result-page.tsx`): carta do Craque (`features/voting/craque-card.tsx`), Perna de
  Pau, Sua nota e a tabela. A carta é a peça que a `pacote-do-craque` vai revelar: exportar como componente
  isolado.
- **Histórico:** `match-card.tsx` ganha a linha do Craque; o detalhe ganha o bloco Resultado
  (`GET .../voting/result`, só em `CLOSED`).
- **Atualização:** `useVoting` com `refetchInterval` de 15 s em `VOTING` e ao voltar para a aba (a `jogo-ao-vivo`
  troca por tempo real depois).
- Gavetas em 180 ms / ~100 ms. Textos: "grandes momentos", nunca "festa"; nenhum dia da semana fixo (a data do
  prazo é a real: "sáb às 21h").
- Rotas novas com `lazy`. Nada de regra no front: o que pode vem de `permissions`; a validação do pacote é a do
  shared/domain. Sem dependência nova.

**Álbum** (`docs/design/prints/votacao/`): um print por cenário de tela (C34–C65) a 390 px; `votar-nota-320`,
`votar-craque-320`, `enviado-320`, `resultado-320`, `inicio-320` e os mesmos em `-desktop`.

### Decisões
- `Vote` + `Rating` (o pacote e as notas dele) — o voto é um pacote: enviar de novo troca tudo numa transação.
- Resultado gravado no `TeamPlayer` — é uma linha por jogador por rodada que já existe; ranking e histórico leem
  direto, e resultado fechado não muda.
- Fechamento por três caminhos (último voto, relógio, leitura) — a API gratuita dorme; nenhum caminho sozinho
  garante a hora certa.
- Voto recusado depois do prazo mesmo sem `CLOSED` — o prazo vale pela hora, não por quem acordou o servidor.
- A nota começa vazia e a primeira batida parte de 6,0 — não dá para "votar" só apertando Próximo; 6 é a nota
  padrão do app.
- Resultado na própria fatia, pacote em outra — quem vota precisa ver o fim da história; a animação do pacote é
  só front e merece uma volta de design própria.
- Admin vê quem falta, nunca o voto — resposta do dono à P12.
- `withRoundLock` vira provider comum — placar, lances e votos disputam a mesma rodada.

## Fora do escopo
- Abertura do pacote do Craque e Compartilhar (`pacote-do-craque`).
- Ranking, médias acumuladas e a nota que o seletor usa (`ranking`).
- Tempo real (`jogo-ao-vivo`), push "votação aberta" e "resultado saiu" (`pwa-e-push`).
- Tela para o admin mudar o prazo; reabrir votação; penalidade para quem não vota.
- Animação "o tropeço" do Perna de Pau e nota contando de 0 (ideias de inspiração, não aprovadas para a v1).

## Perguntas respondidas pelo dono
- Nota para todos, sem pular; voto em 2 passos; voto editável até fechar; empate pela nota (22–23 out 2026).
- P2 · Prazo da votação? → 24 horas depois de o admin abrir; o admin pode encerrar antes (14 nov 2026).
- P12 · Quem vê quem ainda não votou? → Todos veem só a contagem; o admin vê os nomes. O voto nunca aparece
  (14 nov 2026).
- P14 · Pacote do Craque em fatia própria? → Sim, `pacote-do-craque` (14 nov 2026).

## QA
<Preenchido no fim: tabela final do QA, número de voltas e veredito.>
