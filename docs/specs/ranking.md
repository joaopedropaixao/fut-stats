# `ranking`

> Spec de fatia da Trilha, escrito pelo líder da v1 (`docs/specs/2026-11-14-autonomia-v1.md`).
> Fluxo da equipe: `docs/specs/2026-10-24-equipe-design.md`.
> Dúvidas respondidas pelo dono em lote: `docs/specs/perguntas-v1.md`.

| | |
|---|---|
| **Fatia** | `ranking` (onda 4) |
| **Modo** | Par |
| **Parte de** | `votacao` (o resultado gravado em `TeamPlayer`) |
| **Status** | aprovado em 2026-11-14 |
| **Base** | develop @4b264a9 (checkpoint 15/11: entraram perfil-jogador #62, ajustes-tela-do-jogo #63, historico #64 e votacao #66; o spec confere com o que a votação grava em `TeamPlayer` e com a rota `historico/:roundId`) |
| **Depende de** | votacao, perfil-jogador |
| **Toca em** | packages/domain/src/ranking, packages/shared/src/ranking.ts, packages/shared/src/index.ts, apps/api/src/ranking, apps/api/src/rounds/rounds.service.ts, apps/api/src/lineups/lineups.service.ts, apps/api/src/app.module.ts, apps/web/src/pages/ranking, apps/web/src/features/ranking, apps/web/src/pages/perfil, apps/web/src/router.tsx, CONTEXT.md, docs/03-roadmap.md |

## Produto

### Objetivo
A aba **Ranking** mostra quem está jogando mais: a classificação geral pela média das notas, por posição e a dos
goleiros, com vitórias, gols, assistências, Craques e Pernas de Pau de cada um. Tocando num jogador, abre a
**figurinha** dele com as estatísticas e as últimas rodadas. E a nota que o seletor de times usa deixa de ser só a
inicial do admin: passa a acompanhar o que o jogador vem fazendo.

### Quem usa
- **Qualquer membro ativo:** vê o ranking e o perfil de qualquer jogador ativo. Só leitura.
- **Usuário de outro grupo, ou membro inativo:** 404.

### Regras de domínio
- **Só conta rodada encerrada** (`CLOSED`): é quando nota e prêmios estão gravados
  ([votacao](votacao.md), "Apuração gravada ao fechar").
- **Recorte**: todas as rodadas encerradas do grupo, desde o início. Temporada (ex.: por semestre) entra com
  o Cartola, na v1.1.
- **Média:** média simples das notas de rodada do jogador (rodada em que ficou sem nota não entra), com 2 casas
  para ordenar; a tela mostra 1 casa.
- **Mínimo para classificar**: o jogador precisa de nota em pelo menos `min(3, rodadas encerradas do grupo)`
  rodadas. Quem tem menos aparece depois dos classificados, sem posição, com "POUCOS JOGOS". Assim o ranking
  existe desde a primeira rodada e, da terceira em diante, um jogo bom não põe ninguém na ponta.
- **Posição no ranking:** maior média primeiro; empate (nas 2 casas) divide a posição e pula a seguinte, como hoje
  (`rankByRating`: [CONTEXT.md › Ranking pela nota](../../CONTEXT.md#ranking-pela-nota-rankbyrating-)).
- **Por posição:** o mesmo ranking, só entre os jogadores com aquela **posição principal** (Zagueiro, Ala, Meia,
  Atacante). **Goleiros:** quem tem `GOALKEEPER` como principal, com os números de goleiro.
- **Estatísticas do jogador:** jogos, vitórias, empates, derrotas, gols, assistências, gols contra, vezes Craque,
  vezes Perna de Pau, jogos com nota, média e **sequência** (quantos resultados iguais seguidos nas últimas
  rodadas que jogou: "3 vitórias seguidas"). Gol contra não conta como gol do jogador
  ([CONTEXT.md › Rodada, placar e scouts](../../CONTEXT.md#rodada-placar-e-scouts-validateroundtransition--validatematchevent--shouldclosevoting-), "Evite").
- **Números de goleiro:** valem para as rodadas em que ele jogou **na vaga de goleiro**: jogos no gol, gols
  sofridos (o placar do adversário), jogos sem sofrer gol e gols sofridos por jogo.
- **Tendência:** quantas posições o jogador subiu ou desceu no ranking geral com a última rodada encerrada
  (compara o ranking com e sem ela). Sem posição antes ou depois, não tem tendência.
- **Nota de referência** (a que o seletor, o card de equilíbrio e a lista de presença usam; é o
  `Player.rating` do domain): média das **5 últimas** notas de rodada do jogador, com a **nota inicial do admin
  completando as que faltam** (com 2 rodadas: 2 notas medidas + 3 vezes a inicial, dividido por 5). Sem rodada com
  nota, é a inicial. Com 5 ou mais, a inicial não pesa mais. A posição mostrada na lista de presença passa a ser
  pela nota de referência.
- **Inativos** ficam fora das listas (o histórico deles continua nas partidas).

### Cenários
Cada cenário tem um id. Os testes levam o id no nome.

**Domínio**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C1 | 4 rodadas de um jogador: V 8,0 com 2 gols; D sem nota; E 7,0 com 1 assistência e Craque; V 6,5 com 1 gol contra e Perna de Pau | `playerStats` | jogos 4; 2 V, 1 E, 1 D; gols 2; assistências 1; gols contra 1; Craque 1; Perna de Pau 1; jogos com nota 3; média 7,17 | unitário |
| C2 | nenhuma rodada | `playerStats` | tudo zero, `average: null`, `streak: null` | unitário |
| C3 | últimos resultados V, V, V (antes uma derrota); D, D; V, E | `playerStats().streak` | `{ result: 'WIN', count: 3 }`; `{ result: 'LOSS', count: 2 }`; `{ result: 'DRAW', count: 1 }` | unitário |
| C4 | goleiro: 3 jogos no gol com 2, 0 e 3 gols sofridos, e 1 jogo na linha | `playerStats().goalkeeper` | jogos 3; sofridos 5; sem sofrer 1; por jogo 1,67. O jogo na linha não entra | unitário |
| C5 | grupo com 1, 2, 3 e 10 rodadas encerradas | `minRatedGames(closedRounds)` | 1, 2, 3, 3; com 0 rodadas, 1 | unitário |
| C6 | médias 8,40 / 8,40 / 7,90 e um jogador com 1 jogo de nota 9,5 (mínimo 3) | `rankPlayers` | posições 1, 1, 3; o de poucos jogos sem posição (`null`), mesmo com a maior média | unitário |
| C7 | ranking antes (A 1º, B 2º, C 3º) e depois (B 1º, A 2º, C 3º, D 4º novo) | `rankTrend` | A −1, B +1, C 0, D `null` | unitário |
| C8 | inicial 6,0 e notas `[]`, `[8]`, `[8, 9]`, cinco notas, sete notas | `referenceRating` | 6,0; 6,4; 7,0; a média das cinco; a média das **cinco últimas** | unitário |
| C9 | `referenceRating` com janela 3 por config | — | usa 3 (parâmetro ajustável, padrão 5) | unitário |

**API**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C10 | grupo com 4 rodadas encerradas e uma em votação | `GET /groups/:groupId/ranking` | `closedRounds: 4`, `minRatedGames: 3`; cada membro ativo com as estatísticas de C1 conferidas contra o banco; a rodada em votação não entra | integração |
| C11 | idem | conferir a ordem | classificados por média, com `rank` (empate divide) e `positionRank` dentro da posição principal; depois os de poucos jogos (`rank: null`), por jogos e apelido | integração |
| C12 | jogador que subiu 2 posições com a última rodada | `GET` | `trend: 2`; quem entrou no ranking agora, `trend: null` | integração |
| C13 | goleiros | `GET` | cada goleiro com `goalkeeper` preenchido; jogadores de linha com `goalkeeper: null` | integração |
| C14 | membro inativo com rodadas | `GET` | não aparece; as posições dos outros não contam com ele | integração |
| C15 | grupo sem rodada encerrada | `GET` | `closedRounds: 0`, todos os ativos com `rank: null` e estatísticas zeradas | integração |
| C16 | membro | `GET /groups/:groupId/members/:membershipId/stats` de um ativo | `PlayerProfile`: o membro (com `avatar`), as estatísticas, `rank`, `positionRank`, `referenceRating` e as 5 últimas rodadas que jogou (número, data, resultado, nota, gols, assistências, selos) | integração |
| C17 | `:membershipId` inativo, de outro grupo ou inexistente | `GET .../stats` | 404 | integração |
| C18 | jogador com inicial 6,0 e notas 8 e 9 nas duas últimas rodadas encerradas | `GET .../rounds/:roundId` (lista de presença) e `GET .../lineup` | `rating` = 7,0 e `rank` pela nota de referência | integração |
| C19 | mesmo jogador | `POST .../lineup/suggestion` | o `balanceTeams` recebe 7,0 como `rating` (o card de equilíbrio da resposta bate com essa nota) | integração |
| C20 | admin muda a nota inicial de quem já tem 5 rodadas com nota | `GET` da lista de presença | a nota não muda (a inicial não pesa mais); com 2 rodadas, muda | integração |
| C21 | usuário de outro grupo, não membro, membro inativo | qualquer rota | 404 | integração |

**Tela** (390 px)

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C22 | seed com rodadas encerradas | abrir a aba Ranking (`/ranking`) | título "Ranking"; no topo o card de grande momento **"VOCÊ ESTÁ EM 4º"** (meu bonequinho, minha média em dígitos pixel, a tendência; pódio com coroa/medalha e moldura de ouro, prata ou bronze no top 3; holofote pixel atrás do bonequinho; animação de subir/descer uma vez por rodada, ver Volta de design); abaixo as abas **Geral · Posição · Goleiros** (folha: Abas/Ranking) | Playwright |
| C23 | aba Geral | olhar a lista (folha: Card/Ranking) | linha por jogador: posição em dígitos pixel, rosto, apelido inteiro, "Meia · 12 jogos", média com 1 casa e a tendência (▲ 2 / ▼ 1 / =, com nome para leitor de tela: "subiu 2 posições"). **Pódio:** 1º, 2º e 3º com medalha pixel pequena ao lado do número (ouro, prata, bronze, com nome para leitor de tela), em todas as abas pela posição mostrada (volta de design). A minha linha com "VOCÊ" e fundo de destaque | Playwright |
| C24 | empate na média | olhar | os dois com a mesma posição; a seguinte é pulada | Playwright |
| C25 | jogadores com poucos jogos | rolar | seção "POUCOS JOGOS", sem posição, com "Precisa de 3 rodadas com nota para entrar no ranking" | Playwright |
| C26 | aba Posição | tocar | seletor Zagueiro · Ala · Meia · Atacante (abre na minha posição; goleiro abre em Zagueiro); a lista mostra só aquela posição, com a posição dentro dela | Playwright |
| C27 | aba Goleiros | tocar | os goleiros por média, cada um com "1,7 GOLS SOFRIDOS POR JOGO" e "3 JOGOS SEM SOFRER GOL" | Playwright |
| C28 | qualquer aba | tocar numa linha | abre `/jogadores/:membershipId` | Playwright |
| C29 | perfil de um jogador | olhar | **figurinha** de grande momento (bonequinho, apelido, posição, posição no ranking, média); grade de estatísticas em dígitos pixel com rótulo por extenso (JOGOS, VITÓRIAS, EMPATES, DERROTAS, GOLS, ASSISTÊNCIAS, CRAQUE, PERNA DE PAU); selo da sequência a partir de 2 ("▲ 3 VITÓRIAS SEGUIDAS"); bloco de goleiro quando for; "ÚLTIMAS RODADAS" com resultado (✓ / ✕ / =), nota e lances, cada linha levando ao detalhe no Histórico | Playwright |
| C30 | o meu perfil (aba Perfil) | olhar | a figurinha ganha posição e média, e abaixo entram a mesma grade e as últimas rodadas | Playwright |
| C31 | jogador sem rodada encerrada | abrir o perfil | "Ainda sem jogos encerrados" no lugar da grade | Playwright |
| C32 | grupo sem rodada encerrada | abrir o Ranking | vazio: "O ranking começa quando a primeira votação fechar" | Playwright |
| C33 | lista de presença (início e detalhe da rodada) | olhar | a nota e a posição mostradas são as de referência (batem com C18) | Playwright |
| C34 | reduzir movimento | abrir | cards com fade, sem degraus; a posição aparece direto no valor final, sem confete | Playwright (`emulateMedia`) |
| C35 | carregando; erro da API; jogador não encontrado | Ranking e perfil | esqueleto; "Não deu para carregar o ranking" com "Tentar de novo"; não encontrado com voltar. Console sem erros no fluxo real | Playwright |
| C36 | larguras 320, 375, 390, 430 px e desktop | Ranking (três abas, com apelidos de 10 letras e posição de dois dígitos) e perfil do jogador | sem rolagem horizontal, sem sobreposição, sem texto cortado; a grade de estatísticas tem 2 colunas em 320 px e 4 a partir de 390 px; alvos ≥ 44 px; no desktop, coluna centralizada. Checagem automática passa | Playwright |

## Técnico

### Contrato
Schemas em `packages/shared/src/ranking.ts` (arquivo novo, exportado no `index.ts`). Primeiro commit da branch
`-back`, com os tipos do domain que ele importa.

| Método | Rota (sob `/api`) | Quem pode | Request | Response | Erros |
|---|---|---|---|---|---|
| `GET` | `/groups/:groupId/ranking` | membro | — | `Ranking` | 404 |
| `GET` | `/groups/:groupId/members/:membershipId/stats` | membro | — | `PlayerProfile` | 404 |

`GET .../rounds/:roundId`, `.../lineup` e `.../lineup/suggestion` não mudam de forma: o campo `rating` passa a
trazer a nota de referência, e `rank` a posição por ela.

```ts
// packages/shared/src/ranking.ts
export const streakSchema = z.object({ result: matchResultSchema, count: z.number().int().positive() });

export const goalkeeperStatsSchema = z.object({
  games: z.number().int(), conceded: z.number().int(), cleanSheets: z.number().int(),
  concededPerGame: z.number().nullable(),   // 2 casas; null sem jogo no gol
});

export const playerStatsSchema = z.object({
  games: z.number().int(), wins: z.number().int(), draws: z.number().int(), losses: z.number().int(),
  goals: z.number().int(), assists: z.number().int(), ownGoals: z.number().int(),
  mvps: z.number().int(), flops: z.number().int(),
  ratedGames: z.number().int(),
  average: z.number().nullable(),           // 2 casas; null sem nota
  streak: streakSchema.nullable(),
  goalkeeper: goalkeeperStatsSchema.nullable(),  // só para quem tem GOALKEEPER como principal
});

export const rankingPlayerSchema = z.object({
  membershipId: z.string(), nickname: z.string(), avatar: avatarSchema,
  primaryPosition: positionSchema,
  rank: z.number().int().positive().nullable(),          // geral; null = poucos jogos
  positionRank: z.number().int().positive().nullable(),  // dentro da posição principal
  trend: z.number().int().nullable(),                    // + subiu, − desceu, 0 igual; null sem comparação
  stats: playerStatsSchema,
});

export const rankingSchema = z.object({
  closedRounds: z.number().int(),
  minRatedGames: z.number().int(),
  players: z.array(rankingPlayerSchema),   // classificados na ordem; depois os de poucos jogos
  me: z.object({ membershipId: z.string() }),
});

export const playerRoundSchema = z.object({
  roundId: z.string(), number: z.number().int(), scheduledAt: z.iso.datetime(),
  team: teamSchema, result: matchResultSchema,
  score: z.number().nullable(), goals: z.number().int(), assists: z.number().int(),
  isMvp: z.boolean(), isFlop: z.boolean(),
});

export const playerProfileSchema = rankingPlayerSchema.extend({
  secondaryPositions: z.array(positionSchema),
  isHiredGoalkeeper: z.boolean(),
  role: roleSchema,
  referenceRating: z.number(),
  lastRounds: z.array(playerRoundSchema),  // até 5, da mais recente para a mais antiga
});
// tipos: Streak, GoalkeeperStats, PlayerStats, RankingPlayer, Ranking, PlayerRound, PlayerProfile
```

### Banco (`schema.prisma`)
Sem mudança. Tudo sai do que `votacao` grava: `TeamPlayer` (`team`, `position`, `isReserve`, `roundScore`, `isMvp`,
`isFlop`), `Round` (`status`, placar, `scheduledAt`, `number`) e `MatchEvent`.

### Domínio
Em `packages/domain/src/ranking/` (o `rank.ts` continua):
- `stats.ts`: `PlayerRoundRecord = { result: MatchResult; goals: number; assists: number; ownGoals: number; score: number | null; mvp: boolean; flop: boolean; playedAsGoalkeeper: boolean; goalsConceded: number }`
  (uma por rodada encerrada que o jogador jogou, **da mais antiga para a mais recente**);
  `playerStats(records: readonly PlayerRoundRecord[]): PlayerStats` (o tipo espelha o schema, sem o corte de
  goleiro: `goalkeeper` vem sempre, e a API decide mostrar).
- `ranking.ts`: `minRatedGames(closedRounds: number, options?: { target?: number }): number` (padrão 3);
  `rankPlayers(players: readonly { id: string; average: number | null; ratedGames: number }[], options: { minRatedGames: number }): Map<string, number | null>`
  (usa `rankByRating` nos classificados); `rankTrend(before: ReadonlyMap<string, number | null>, after: ReadonlyMap<string, number | null>): Map<string, number | null>`.
- `reference.ts`: `DEFAULT_REFERENCE_WINDOW = 5`;
  `referenceRating(initialRating: number, roundScores: readonly number[], options?: { window?: number }): number`
  (notas da mais antiga para a mais recente; resultado com 2 casas).
- Nada lança; arredondamento meio para cima, como `roundScore`. `CONTEXT.md`: atualizar "Ranking pela nota"
  (deixa de ser "até a Fase 3"), registrar as funções novas e a nota de referência, e ajustar `Player.rating`.

Na API:
- Módulo novo `apps/api/src/ranking` (`RankingController`, `RankingService`). Uma leitura traz os `TeamPlayer` das
  rodadas `CLOSED` do grupo (com placar, data e número) e os lances agrupados por jogador e rodada; o service
  monta os `PlayerRoundRecord` e chama o domain. A tendência calcula o ranking duas vezes (com e sem a última
  rodada encerrada).
- `RankingService.referenceRatings(groupId, db?)` devolve `Map<membershipId, number>`. `rounds.service` (lista de
  presença) e `lineups.service` (`ranks`, os jogadores do `balanceTeams` e o `rating` dos escalados) passam a usar
  esse mapa no lugar de `initialRating`. O `RankingModule` exporta o service.
- O roster do admin (`perfil-jogador`) continua mostrando a **nota inicial**, que é o que ele edita.

### Tela
Regras de visual do documento de autonomia valem como critério. Peças da folha: "Feed e ranking" (Abas/Ranking,
Card/Ranking) e "Figurinhas".
- **Ranking** (`pages/ranking/ranking-page.tsx`, rota da aba `/ranking` no `TAB_PAGES`). Referência: a lista
  "Quem vai" do início (nota + posição) para a linha, e `TeamSegmented` para as abas.
  - Card "VOCÊ ESTÁ EM Nº" em `moment-frame` com entrada em degraus; se não estou classificado: "FALTAM 2 RODADAS
    PARA VOCÊ ENTRAR NO RANKING".
  - Abas e seletor de posição são `radiogroup` nativos; a aba escolhida fica na URL (`?aba=posicao&posicao=WINGER`)
    para o voltar do navegador funcionar.
  - Linha de 72 px, um link inteiro (alvo único). Colunas de largura fixa para posição, média e tendência, para
    alinhar entre linhas.
  - Tendência: ▲ em `--color-success`, ▼ em `--color-danger`, "=" apagado; sempre com o número.
- **Perfil do jogador** (`pages/ranking/player-page.tsx`, rota `jogadores/:membershipId`). Referência: a figurinha
  do Perfil de `perfil-jogador` (tem que estar aprovada antes). A grade de estatísticas
  (`features/ranking/stats-grid.tsx`) é reusada na aba Perfil.
- Faixa de nota ou carta (se aparecer): só com `cardTier(rating)` do domínio, quando entrar na develop (equipe `pacote-do-craque`); não criar outra regra. Ouro é recompensa (só o líder); amarelo só na tecla de ação, nunca competindo com ouro no mesmo card.
- **Perfil** (`pages/perfil/profile-page.tsx`): bloco de estatísticas abaixo da figurinha, com os dados de `GET .../stats` da minha
  participação.
- Rotas novas com `lazy`. Nada de regra no front: ordem, posição, tendência e mínimo vêm da API. Sem dependência
  nova.

**Álbum** (`docs/design/prints/ranking/`): um print por cenário de tela (C22–C35) a 390 px; `ranking-320`,
`jogador-320`, `ranking-desktop`, `jogador-desktop`.

### Decisões
- Calcular na leitura, sem tabela de ranking — são poucas dezenas de linhas por rodada; o resultado por jogador já
  está gravado.
- Uma resposta com todos os jogadores e as três visões — o grupo tem ~25 pessoas; trocar de aba não espera a rede.
- Mínimo de `min(3, rodadas do grupo)` — resposta do dono à P4.
- Nota de referência com a inicial completando a janela de 5 — resposta do dono à P3: transição suave da nota do admin para a
  medida, e o seletor acompanha a fase do jogador.
- Média do ranking (tudo) e nota de referência (5 últimas) são números diferentes de propósito — o ranking premia
  a história; o seletor quer saber como o jogador está agora. A tela do ranking mostra a média; listas de presença
  e times mostram a nota de referência.
- Goleiro contado pela vaga em que jogou — a regra que o Cartola já usa.

## Volta de design (15/11/2026, pedida pelo dono no PR #67)
O dono achou o card do topo "com o fundo verde, que é meio padrão do app" e escolheu três ideias. Aprovado por ele
depois de testar.

1. **Animação de subir/descer** (`features/ranking/rank-seen.ts`, `rank-reveal.ts`, `use-rank-reveal.ts`,
   `rank-confetti.tsx`). Na primeira abertura do ranking depois de uma rodada nova, o número vai em degraus da
   posição antiga (`rank + trend`, da API) para a nova, no máximo 6 números (salto maior é amostrado), e a seta pula.
   Subiu: confete pixel (ouro, verde e branco). Desceu: só a seta vermelha. Manteve, sem tendência ou fora do
   ranking: nada. Uma vez por rodada e por jogador: chave `fut-stats:ranking-visto:<membershipId>:<closedRounds>`,
   storage injetável com `try/catch` (padrão do `result-seen.ts`). Só `transform`/`opacity` em `steps()`; reduzir
   movimento mostra o final. Duração ≈ 0,9 s em +2; num salto de 5 ou mais chega a ≈ 1,3 s (contagem + confete),
   aceito pelo dono ao aprovar a volta; ajuste é `MAX_REVEAL_STEPS` ou confete mais curto.
2. **Pódio** (`podium.ts`, `medal.tsx`). Top 3 com coroa (1º) ou medalha com fita (2º, 3º) e moldura na cor do
   degrau no card do topo; medalha pequena nas listas (Geral por `rank`, Posição/Goleiros por `positionRank`; empate
   ganha a mesma). A medalha é o sinal, a cor reforça. Substitui o "só o líder em ouro" e a pergunta do 1º em ouro
   nas abas Posição/Goleiros. A figurinha usa as mesmas cores e medalha, para não divergir. Tokens novos
   `--color-silver*` e `--color-bronze*` (`theme.css`, `docs/design/tokens.css`, `DESIGN.md`); nenhum amarelo de
   ação. A moldura pela média (`cardTier`, PR #69) fica fora.
3. **Fundo do card: holofote pixel atrás do bonequinho** (`spotlight.tsx`, commit próprio `a3fbbbb`, reversível com
   `git revert` sozinho; o dono disse que o fundo é teste). **Escolhido no lugar do corte diagonal do `Scoreboard`**
   porque o branco/preto do placar quer dizer "Branco x Preto" (os times) e o número da posição cairia sobre uma
   das metades, piorando o contraste em 320 px; o holofote fica só no quadro do bonequinho, o número e o texto
   seguem no fundo do card (contraste 9,8 / 7,15; ouro 5,69, prata 6,6, bronze 5,63) e o jogador ganha palco.

QA da volta: aprovado. Animação (subiu, desceu, manteve, segunda abertura, reduzir movimento, storage bloqueado),
pódio nas três abas, no topo e na figurinha, sem amarelo de ação, revert do holofote limpo (`git apply --check -R`),
checagem automática em 320/375/390/430/1280 (80 combinações, 0 problemas), console sem erros, web verde e JS
inicial 146,4 de 150 kB. Prints `design-*` no álbum (antes/depois, com e sem holofote, pódio, quadros da animação).

## Fora do escopo
- Temporadas e reinício do ranking.
- "Modo estrela" na sequência de vitórias e outras animações de ideias não aprovadas.
- Comparar dois jogadores; gráficos de evolução.
- Ranking do Cartola (v1.1).
- Recalibrar o seletor com as notas reais (item "Futuro" do roadmap).

## Perguntas respondidas pelo dono
- Lista de presença mostra nota e posição no ranking (24 out 2026).
- P3 · Qual nota o seletor e a lista de presença usam depois da votação? → A média das 5 últimas rodadas, com a
  nota inicial completando enquanto houver menos de 5 (14 nov 2026).
- P4 · O que o ranking conta e o mínimo de jogos? → Tudo desde o início; mínimo de 3 rodadas com nota (ou todas,
  enquanto o grupo tiver menos de 3) (14 nov 2026).

## QA
2 voltas. **Veredito: aprovado** (volta 2, 15/11/2026).

Volta 1 reprovou com 2 falhas de front: a frase "FALTAM N RODADAS…" de quem está fora do ranking não quebrava e
gerava rolagem horizontal (C22/C36); a etiqueta ADMIN amarela dividia a figurinha com o ouro do líder (C29/C30).
Decisão do TPL: ADMIN neutro sempre na figurinha. Ambas corrigidas com teste que reproduz.

| Cenário | Resultado | Evidência |
|---|---|---|
| C1–C9 (domínio) | ✅ | `packages/domain/src/ranking/{stats,ranking,reference}.test.ts`, id no nome |
| C10–C16, C18–C20 (API) | ✅ | `apps/api/src/ranking/ranking.spec.ts` (18 testes, Postgres real); C18 também ao vivo na lista de presença |
| C17, C21 (404) | ✅ | `ranking.spec.ts` + curl (inexistente, outro grupo e inativo → 404; sem login → 401) |
| C22 | ✅ | `c22-voce-esta-em`, `c22-fora-do-ranking-390/320`; `you-card.test.tsx` |
| C23–C28 | ✅ | `c23`…`c28`; C24 com dado montado no navegador (a seed não tem empate) |
| C29, C30 | ✅ | `c29-figurinha`, `c29-figurinha-goleiro`, `c30-meu-perfil`, `c30-admin-lider`; `player-card.test.tsx` |
| C31, C32, C35 | ✅ | dado montado no navegador (sem caso na seed); "não encontrado" com 404 real |
| C33 | ✅ | `c33-lista-de-presenca` (nota e posição de referência iguais à API) |
| C34 | ✅ | `vs-fade 0.2s`, sem degraus |
| C36 | ✅ | checagem automática em 320/375/390/430/1280: 70 combinações (três abas como Carlão e Serginho, figurinhas de goleiro, nome longo, poucos jogos e admin, /perfil), sem rolagem, corte, sobreposição ou alvo < 44 px; console sem erros |

`pnpm lint && pnpm typecheck && pnpm test && pnpm build` verdes (api 445 testes); JS inicial 146,4 de 150 kB.

Decisões dos DEVs fora do texto (nenhuma fere o spec): tendência só na aba Geral; Posição/Goleiros mostram
`positionRank` e o 1º da posição em ouro; rótulos da grade em Chakra Petch 13 px (Silkscreen não cabe);
reserva não conta como jogo no gol; poucos jogos por `stats.games` e apelido; tendência `null` com ≤ 1 rodada.
