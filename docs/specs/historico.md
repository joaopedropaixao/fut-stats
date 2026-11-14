# `historico`

> Spec de fatia da Trilha, escrito pelo líder da v1 (`docs/specs/2026-11-14-autonomia-v1.md`).
> Fluxo da equipe: `docs/specs/2026-10-24-equipe-design.md`.

| | |
|---|---|
| **Fatia** | `historico` (onda 2) |
| **Modo** | Par |
| **Parte de** | PR #31 (fechar), branch `origin/feature/tela-historico`: aproveitar `matchWinner` e a paginação por cursor; as telas são refeitas |
| **Status** | rascunho |
| **Base** | develop @1021769 |
| **Depende de** | perfil-jogador |
| **Toca em** | packages/domain/src/round, packages/shared/src/history.ts, packages/shared/src/index.ts, apps/api/src/history, apps/api/src/lineups/lineups.service.ts, apps/api/src/app.module.ts, apps/web/src/pages/historico, apps/web/src/features/history, apps/web/src/pages/rounds/detail.tsx, apps/web/src/router.tsx |

## Produto

### Objetivo
A aba **Histórico** mostra as partidas que já terminaram, da mais recente para a mais antiga, cada uma com o placar
e o resultado de quem está vendo. Tocando numa partida, o jogador vê o placar grande, os dois times no campo e os
lances. As notas e o Craque entram nesta mesma tela na fatia `votacao`.

### Quem usa
- **Qualquer membro ativo** (jogador ou admin): vê a lista e o detalhe. É só leitura.
- **Usuário de outro grupo, ou membro inativo:** 404.

### Regras de domínio
- **Entra no histórico a rodada com o jogo finalizado:** `POST_MATCH` (Resenha), `VOTING` ou `CLOSED`
  (`isMatchFinished`). Rodada em jogo fica no início; rodada que não aconteceu foi apagada antes do jogo
  ([CONTEXT.md › Rodada, placar e scouts](../../CONTEXT.md#rodada-placar-e-scouts-validateroundtransition--validatematchevent--shouldclosevoting-)).
  Toda rodada finalizada tem placar (finalizar exige o placar).
- **Ordem:** pela data marcada, da mais recente para a mais antiga; empate pela ordem de criação (número maior
  primeiro).
- **Vencedor:** `matchWinner(score)` → `WHITE`, `BLACK` ou `DRAW`. O resultado de quem vê é o `matchResult` que já
  existe; quem não jogou não tem resultado.
- **Correção junto (bug achado pelo líder):** o histórico do seletor de times (`lineups.service`, `playedHistory`)
  lista `IN_PROGRESS`, `VOTING` e `CLOSED` e **esquece `POST_MATCH`**: rodada na Resenha não conta para duplas
  repetidas nem para a panelinha. Passa a usar `isRoundPlayed` (em jogo ou finalizada), com teste que reproduz.

### Cenários
Cada cenário tem um id. Os testes levam o id no nome.

**Domínio**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C1 | cada status | `isMatchFinished` | `true` só em `POST_MATCH`, `VOTING` e `CLOSED` | unitário |
| C2 | cada status | `isRoundPlayed` | `true` em `IN_PROGRESS`, `POST_MATCH`, `VOTING` e `CLOSED` | unitário |
| C3 | placares 3x2, 1x4 e 2x2 | `matchWinner` | `WHITE`, `BLACK`, `DRAW` | unitário |

**API**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C4 | grupo com rodadas em todos os status | `GET /groups/:groupId/history` | só as finalizadas, da mais recente para a mais antiga, cada uma com `number`, `scheduledAt`, `location`, `status`, `score` e `winner` | integração |
| C5 | quem pede jogou no Branco numa partida 3x2, no Preto em outra, e não jogou numa terceira | `GET` | `me` = `{ team: 'WHITE', result: 'WIN' }`, `{ team: 'BLACK', result: 'LOSS' }` e `null`; reserva conta como quem jogou | integração |
| C6 | 25 partidas finalizadas | `GET` sem query; depois com `cursor` = `nextCursor` | 20 itens e `nextCursor`; os 5 restantes e `nextCursor: null`; nenhuma repetida nem pulada | integração |
| C7 | duas partidas com a mesma data marcada | paginar com `limit=1` | as duas aparecem, uma por página (desempate pelo número) | integração |
| C8 | `limit=0`, `limit=51`, `cursor` de rodada que não existe ou de outro grupo | `GET` | 400 de validação / 400 `INVALID_CURSOR` | integração |
| C9 | grupo sem partida finalizada | `GET` | `{ items: [], nextCursor: null }` | integração |
| C10 | rodadas de outro grupo no banco | `GET` | não aparecem | integração |
| C11 | usuário de outro grupo, não membro, membro inativo | `GET` | 404 | integração |
| C12 | seletor: dupla junta e vencendo numa rodada em `POST_MATCH` | `POST .../lineup/suggestion` na rodada seguinte | a rodada da Resenha conta no histórico (a dupla é separada, como no "seletor C16") | integração (reproduz o bug) |

**Tela** (390 px)

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C13 | seed com rodadas passadas | abrir a aba Histórico (`/historico`) | título "Histórico" e uma lista de **cards de partida**. Cada card é grande momento (contorno de 3 px, sombra dura) e entra em degraus, um depois do outro (os 6 primeiros; o resto aparece sem animar) | Playwright |
| C14 | card de uma partida 3x2 em que joguei no Branco | olhar | "RODADA 12" em ouro e a data ("SÁB, 17 OUT"); placar com corte diagonal e dígitos pixel; o time vencedor com ✓ e "VENCEU"; faixa **"VOCÊ VENCEU"** com ✓ (derrota: "VOCÊ PERDEU" com ✕; empate: "EMPATE" com =; não joguei: "VOCÊ NÃO JOGOU", apagado). Nunca só cor | Playwright |
| C15 | partida em `POST_MATCH` ou `VOTING` | olhar o card | selo com a etapa ("RESENHA", "VOTAÇÃO") | Playwright |
| C16 | mais de 20 partidas | rolar até o fim e tocar em "Carregar mais" | entram as próximas, sem pular para o topo; a tecla some quando acaba | Playwright |
| C17 | card | tocar | abre `/historico/:roundId` | Playwright |
| C18 | detalhe de partida encerrada | olhar | botão "Histórico" (voltar); "RODADA 12", data e local; **placar grande** (grande momento, o mesmo da tela do jogo); faixa "VOCÊ VENCEU 3 A 2 NO BRANCO" (ou a variante); seletor Branco / Preto abrindo no meu time; o **campo 1-2-3-1** só para ver, com os rostos e "VOCÊ" em mim; reservas; e a lista **Lances** do time escolhido, na ordem em que foram lançados | Playwright |
| C19 | detalhe, time sem lance | olhar | "Nenhum lance do Preto nesta partida" | Playwright |
| C20 | detalhe, gol contra | olhar | aparece na lista do time que ganhou o gol, com o rosto e o anel do time de quem fez (como na Resenha) | Playwright |
| C21 | detalhe de partida em `POST_MATCH` | olhar | tudo igual, mais a tecla de contorno "Ir para a Resenha" → `/rodadas/:roundId/jogo` | Playwright |
| C22 | `/historico/:roundId` de rodada que ainda não terminou | abrir | "Essa partida ainda não terminou" com link para a rodada | Playwright |
| C23 | detalhe da rodada (`/rodadas/:roundId`) em `VOTING` ou `CLOSED` | olhar | o próximo passo é "Ver partida" → `/historico/:roundId` | Playwright |
| C24 | grupo sem partida | abrir a aba | vazio: "Nenhuma partida ainda" e "Quando a primeira pelada terminar, o placar aparece aqui." | Playwright |
| C25 | carregando; erro da API; partida não encontrada | abrir lista e detalhe | esqueleto; erro com "Tentar de novo"; "Partida não encontrada" com voltar para o Histórico. Console sem erros no fluxo real | Playwright |
| C26 | reduzir movimento | abrir a lista | os cards aparecem com fade, sem degraus | Playwright (`emulateMedia`) |
| C27 | larguras 320, 375, 390, 430 px e desktop | lista e detalhe (com placar de dois dígitos, 10x12, e apelidos de 10 letras) | sem rolagem horizontal, sem sobreposição, sem texto cortado, alvos ≥ 44 px; no desktop, coluna centralizada. Checagem automática passa | Playwright |

## Técnico

### Contrato
Schemas em `packages/shared/src/history.ts` (arquivo novo, exportado no `index.ts`). Primeiro commit da branch
`-back`, com os acréscimos de domínio que ele importa.

| Método | Rota (sob `/api`) | Quem pode | Request | Response | Erros |
|---|---|---|---|---|---|
| `GET` | `/groups/:groupId/history` | membro | query `HistoryQuery` | `HistoryList` | 400 validação / `INVALID_CURSOR`; 404 |

O detalhe não tem rota nova: a tela usa `GET .../rounds/:roundId/match` (`MatchView`) e
`GET .../rounds/:roundId/lineup` (`Lineup`), que já existem e já devolvem tudo a qualquer membro.

```ts
// packages/shared/src/history.ts
export const HISTORY_PAGE_DEFAULT = 20;
export const HISTORY_PAGE_MAX = 50;
export const INVALID_CURSOR_LABEL = 'Não deu para continuar a lista. Abra o Histórico de novo.';

/** Query de GET .../history. `cursor` = o `nextCursor` da página anterior (o id da última rodada dela). */
export const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(HISTORY_PAGE_MAX).default(HISTORY_PAGE_DEFAULT),
  cursor: z.string().min(1).optional(),
});

export const matchWinnerSchema = z.enum(MATCH_WINNERS);            // 'WHITE' | 'BLACK' | 'DRAW'
export const MATCH_WINNER_LABELS: Record<MatchWinner, string>;     // 'Branco venceu', 'Preto venceu', 'Empate'

/** Uma partida finalizada na lista. */
export const historyItemSchema = z.object({
  roundId: z.string(),
  number: z.number().int().positive(),
  scheduledAt: z.iso.datetime(),
  location: z.string().nullable(),
  status: roundStatusSchema,             // POST_MATCH | VOTING | CLOSED
  score: matchScoreSchema,
  winner: matchWinnerSchema,
  /** Quem pede: o time em que jogou e o resultado. Nulo = não jogou. */
  me: z.object({ team: teamSchema, result: matchResultSchema }).nullable(),
});

export const historyListSchema = z.object({
  items: z.array(historyItemSchema),
  nextCursor: z.string().nullable(),
});
// tipos: HistoryQuery, HistoryItem, HistoryList, MatchWinner
```

### Banco (`schema.prisma`)
Sem mudança. A lista sai de `Round` (`status`, `scheduledAt`, `number`, placar) e de `TeamPlayer` (o time de quem
pede). O índice `@@index([groupId, scheduledAt])` já cobre a ordenação.

### Domínio
Em `packages/domain/src/round/`:
- `status.ts`: `isMatchFinished(status: RoundStatus): boolean` e `isRoundPlayed(status: RoundStatus): boolean`.
- `match.ts`: `MATCH_WINNERS = ['WHITE', 'BLACK', 'DRAW'] as const` e
  `matchWinner(score: MatchScore): MatchWinner` (da branch antiga, `winner.ts`).
- `CONTEXT.md`: acrescentar os três na seção "Rodada, placar e scouts" e uma entrada "Histórico" com a rota.

Na API: módulo novo `apps/api/src/history` (controller + service, `PrismaService` injetado). Uma consulta com
`where: { groupId, status: { in: [...] } }`, `orderBy: [{ scheduledAt: 'desc' }, { number: 'desc' }]`,
`take: limit + 1` e o cursor como "antes de (scheduledAt, number) da rodada do cursor"; o time de quem pede vem
num `select` de `teamPlayers` filtrado pela membership. Em `lineups.service`, `playedHistory` troca a lista fixa de
status por `ROUND_STATUSES.filter(isRoundPlayed)`.

### Tela
Regras de visual do documento de autonomia valem como critério.
- **Lista** (`pages/historico/history-page.tsx`, rota da aba `/historico` no `TAB_PAGES`). Referência: a lista de
  `/rodadas` para a estrutura (título, estados, `RoundHeading`) e o card do início (`game-card.tsx`) para o card.
  - **Card de partida** (`features/history/match-card.tsx`; folha: O clássico › Card/Partida): `moment-frame`,
    `Scoreboard` com `compact bare` (o corte diagonal é só do placar), cabeçalho com rodada e data, rodapé com a
    faixa do meu resultado. O card inteiro é um link (um alvo só, ≥ 44 px, com `aria-label` completo: "Rodada 12,
    sábado 17 de outubro, Branco 3, Preto 2, você venceu").
  - Entrada em degraus com atraso crescente (`animate-row-in` com `--moment-delay`), só nos 6 primeiros.
  - "Carregar mais": tecla de contorno, com estado de carregando. `useInfiniteQuery` do TanStack.
- **Detalhe** (`pages/historico/history-detail-page.tsx`, rota `historico/:roundId`). Referência: a tela do jogo
  (`match-page.tsx`) em modo leitura e os times publicados.
  - `Scoreboard` cheio; faixa de resultado no padrão da `you-banner.tsx` (com o meu bonequinho);
    `PublishedTeams` sem o VS (sem `roundId`) para o campo e as reservas; `EventList` só leitura por time.
  - O texto do resultado sai de uma função pura com teste (`history-text.ts`): vitória, derrota, empate, não jogou.
- **Detalhe da rodada** (`pages/rounds/detail.tsx`): `nextStep` aponta para o histórico em `VOTING` e `CLOSED`.
- Rotas novas com `lazy` (ver `orcamento-de-bundle`).
- Nada de regra no front: vencedor e resultado vêm da API. Sem dependência nova.
- Ao abrir o PR desta fatia, fechar o PR #31.

**Álbum** (`docs/design/prints/historico/`): um print por cenário de tela (C13–C26) a 390 px; `lista-320`,
`detalhe-320`, `lista-desktop`, `detalhe-desktop`.

### Decisões
- Histórico = jogo finalizado (da Resenha em diante) — a partida já tem placar final; em jogo ela está no início.
- Detalhe sem rota nova — `match` e `lineup` já devolvem tudo a qualquer membro; menos contrato para manter.
- O campo no detalhe, não uma tabela — é a segunda assinatura do app e a peça já existe só para ver.
- Cursor = id da última rodada — a ordem é estável (data, número) e a API não precisa codificar nada.
- Cada card da lista é grande momento — regra 1 do visual; a animação fica só nos primeiros para a rolagem não
  pesar.
- Corrigir o `POST_MATCH` no histórico do seletor aqui — é a fatia que cria o conceito "rodada jogada" no domain.

## Fora do escopo
- Notas, Craque e Perna de Pau no card e no detalhe (`votacao`).
- Filtro por jogador, por período ou busca.
- Estatísticas acumuladas (`ranking`).
- Mexer na lista de `/rodadas` (continua sendo a visão do admin, com próximas e passadas).

## Perguntas respondidas pelo dono
- Nenhuma nova. Decisões já registradas: rodada = uma partida; gol contra na lista do time que ganhou o gol
  (25 out 2026).

## QA
<Preenchido no fim: tabela final do QA, número de voltas e veredito.>
