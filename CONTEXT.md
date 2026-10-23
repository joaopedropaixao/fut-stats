# Contexto do domínio

Glossário vivo: o que cada coisa do domínio **é**, o que **faz e não faz**, o que **devolve** e o que **evitar**.
Leia antes de mexer em `packages/domain`, `packages/shared` ou em regra de negócio na API.
Item novo no domínio entra aqui **no mesmo PR**, neste formato. Mudou o comportamento? Atualize a entrada.

Status: ✅ implementado · 🚧 em PR · 📋 planejado (só nos docs, nomes no código a definir)

---

## Decisões fixas (não rediscutir)

- **Goleiro é uma posição** (`GOALKEEPER`), não um tipo de jogador. "Goleiro contratado vs. mensalista" é dado
  de cadastro (Membership), não do domínio.
- **Valores de enum em inglês** no código (`WINGER`, `WHITE`); textos em português só em `packages/shared`
  (`POSITION_LABELS`, `TEAM_LABELS`).
- **O domain é a fonte; o shared deriva.** Constantes e regras nascem em `packages/domain`; os schemas Zod do
  `shared` são gerados a partir delas (`z.enum(POSITIONS)`), nunca o contrário.
- **Validação do domínio responde, não lança.** O domínio nunca dá `throw` por entrada inválida; quem decide o erro
  (400, mensagem na tela) é a borda (controller/formulário). Três formas, conforme a necessidade:
  - `is*`/`matches*` → `boolean`, para um "pode ou não pode" rápido.
  - `validate*` → **código de erro** (`'SELF_VOTE'`) ou `null`/lista vazia, para dizer **por quê**. Os códigos
    ficam numa lista `*_ERRORS` no domain; o texto de cada um fica no `shared` (`*_ERROR_LABELS`, um
    `Record<código, string>`: código sem mensagem não compila).
  - `parse*` → `Result<T, E>` (`{ ok: true, value }` ou `{ ok: false, errors }`). O `value` tem um tipo "carimbado"
    (ex.: `ValidRatings`) que só o `parse*` cria. **Função de cálculo só aceita entrada carimbada**: chamar sem
    validar antes não compila, então o cálculo não precisa checar nem lançar nada.
- **Prêmios da rodada: Craque e Perna de Pau** (nomes do design). No código ficam `MVP`/`mvp` e `FLOP`/`flop`
  (`AWARDS` no domain, textos em `AWARD_LABELS` no shared). "Bola Murcha" é o nome antigo: não usar.
- **Domínio não conhece banco nem usuário.** Recebe ids (`string`) e números; não recebe entidade do Prisma.
- **Goleiro contratado é membro pleno:** joga, vota (notas, Craque, Perna de Pau) e participa do Cartola.
- **Grupo de confiança:** só entra quem é convidado. Sem antifraude pesado; a média aparada basta.
- **Votar e jogar o Cartola são opcionais.** A rodada só exige os 2 goleiros e os confirmados. Regra de notas e
  Cartola tem que funcionar com adesão parcial (poucos votos, poucos times no Cartola) sem quebrar nem travar.
- **Voto é um pacote, e quem vota avalia todos** (dono, 22–23 out 2026). Votar é opcional como um todo; quem vota
  manda nota para **todos** que jogaram (menos ele mesmo, sem pular ninguém) + Craque + Perna de Pau.
- **Voto pode ser alterado enquanto a votação está aberta**: até o prazo (`Group.votingDeadlineHours`, valor ainda
  não definido), ou antes, se todos votarem ou o admin encerrar. Fechou, não muda mais.
- **Apelido com até 10 letras** (regra do `Membership`; `validateNickname`, ver "Grupo, convite e entrada").
- **Nota inicial padrão 6** (dono, 23 out 2026): quem entra no grupo (pelo convite ou criando) começa com nota 6,
  só como referência visual e ponto de partida do seletor, até o admin ajustar no perfil. A primeira média medida
  de fato sai da primeira rodada que o jogador completar e receber votos.
- **Convite não reativa membro** (dono, 23 out 2026): membro desativado pelo admin que usa o link recebe erro e
  precisa falar com o admin. Reativar é do admin (perfil do jogador).
- **Prévia do convite é pública** (dono, 23 out 2026): sem login, mostra só o nome da pelada e quantos membros ativos
  ela tem. Nada de nomes de membros.
- **Nota da rodada com poucos votos:** com 3 votos ou menos, média simples; a partir de 4, média aparada.

---

## Núcleo (`packages/domain/src/core`)

### Posição: `Position` ✅
**O que é:** uma das 5 posições da formação 1-2-3-1: `GOALKEEPER`, `DEFENDER`, `WINGER` (ala), `MIDFIELDER`, `FORWARD`.
Lista em `POSITIONS`; `isPosition(valor)` checa um valor desconhecido.
**Devolve:** `isPosition` → `boolean` (e estreita o tipo).
**Evite:** valores em português (`'ZAGUEIRO'`); `LATERAL` ou `VOLANTE` (não existem, ala é `WINGER`);
comparar string crua vinda de fora sem `isPosition`/`positionSchema`.

### Time: `Team` ✅
**O que é:** um dos dois times de toda rodada: `WHITE` (Branco) ou `BLACK` (Preto). Lista em `TEAMS`.
`opponentOf(time)` devolve o outro.
**Não faz:** não existe terceiro time, mandante/visitante nem id de time.
**Evite:** `A/B`, `home/away`, `1/2`; supor que um time é "o forte" ou que a ordem significa algo.

### Formação: `FORMATION` / `PLAYERS_PER_TEAM` / `MAX_RESERVES_PER_TEAM` ✅
**O que é:** quantos jogadores por posição num time: 1 goleiro, 2 zagueiros, 2 alas, 1 meio, 1 atacante.
`PLAYERS_PER_TEAM` = 7 (calculado da formação). `MAX_RESERVES_PER_TEAM` = 2: padrão do `balanceTeams` e da
validação dos times da rodada.
**Não faz:** não há formação alternativa (4-3-3 etc.). A pelada e o Cartola usam sempre 1-2-3-1.
**Evite:** escrever `7`, `2 zagueiros` ou `2 reservas` direto no código; use as constantes.

### Nota: `isValidRating` / `validateRating` ✅
**O que é:** nota de 0 a 10, de 0,5 em 0,5 (`RATING_MIN`, `RATING_MAX`, `RATING_STEP`).
**Devolve:** `isValidRating` → `boolean`; `validateRating` → `RatingError` (`'NOT_A_NUMBER'`, `'OUT_OF_RANGE'`,
`'INVALID_STEP'`, lista em `RATING_ERRORS`) ou `null` se válida. Textos em `RATING_ERROR_LABELS` (shared).
**Não arredonda nem corrige**: `7.3` é inválida, não vira `7.5`.
**Evite:** escala 0–100, nota inteira, nota como string; arredondar em silêncio para "aceitar".

### Resultado de validação: `Result<T, E>` ✅
**O que é:** `{ ok: true, value: T } | { ok: false, errors: E[] }`. O que as funções `parse*` devolvem: o valor
validado ou **todos** os problemas encontrados (não para no primeiro).
**Evite:** `throw` no domínio por entrada inválida; devolver só o primeiro erro quando dá para listar todos.

### Jogador: `Player` ✅
**O que é:** o que as regras precisam saber de um jogador: `id`, `primaryPosition`, `secondaryPositions`
(usadas quando falta gente na principal) e `rating` (nota de referência: média recente ou a inicial do admin).
**Não é:** `User` (login) nem `Membership` (participação no grupo). Não tem nome, foto nem email.
**Evite:** passar a entidade do Prisma direto; adicionar campos de tela; recalcular `rating` dentro de uma regra.

### Escalação: `LineupSlot` / `TeamLineup` / `RoundLineup` ✅
**O que é:** `LineupSlot` = jogador numa posição (`{ playerId, position }`). `TeamLineup` = lista de slots de um time.
`RoundLineup` = `{ WHITE, BLACK }`, os dois times da rodada.
**Funções:** `countByPosition` → contagem por posição (inclui zeros); `matchesFormation` → o time é 1-2-3-1 exato
e sem jogador repetido; `isValidRoundLineup` → os dois times válidos e nenhum jogador nos dois.
**Devolvem:** contagem ou `boolean`. **Não corrigem** a escalação nem dizem o que está errado.
**Evite:** representar escalação como `Map<jogador, time>`; supor que a ordem dos slots indica posição.

### Papel: `Role` ✅
**O que é:** papel de um membro no grupo: `ADMIN` ou `PLAYER`. Lista em `ROLES` (igual ao enum `Role` do banco).
Schema `roleSchema` no shared.
**Evite:** papel no `User` (é da Membership de cada grupo); tratar `ADMIN` como "não joga".

---

## Regras (`packages/domain/src/<regra>`)

### Seletor de times: `balanceTeams` ✅
**O que é:** gera Branco x Preto equilibrados a partir dos confirmados da rodada. É sugestão: o admin pode
editar antes de publicar.
**Assinatura:** `balanceTeams(players: readonly Player[], history: readonly PastRound[] = [], config: Partial<BalanceTeamsConfig> = {})`.
- `history`: rodadas anteriores, **da mais antiga para a mais recente**. `PastRound` = `RoundLineup` + `reserves?` opcional.
- `config` (defaults em `DEFAULT_BALANCE_TEAMS_CONFIG`):
  - `repeatedPairWeight` (λ) = `0.5`: custo de cada dupla repetida, em pontos de força.
  - `lookbackRounds` = `3`: quantas rodadas recentes do histórico contam.
  - `offPositionFactor` = `0.9`: multiplica a nota de quem joga na posição secundária.
  - `maxReservesPerTeam` = `MAX_RESERVES_PER_TEAM` (2).
  - `random` = `Math.random`: desempate. Use `seededRandom(seed)` (exportado) para ter determinismo.

**Faz:**
- Aceita de 14 a `14 + 2 · maxReservesPerTeam` confirmados (18 por padrão), com **exatamente 2 goleiros**
  (`primaryPosition === 'GOALKEEPER'`), um em cada time.
- Quem passa de 14 vira reserva de um time, com no máximo 1 de diferença de reservas entre os times
  (15 → 1x0, 16 → 1x1...).
- Jogador de linha joga na posição principal ou numa secundária, com o **mínimo possível** fora da principal.
- Minimiza `|força Branco − força Preto| + λ · duplas repetidas` testando **todas** as divisões possíveis
  (≈ 90 ms com 18). Empates são sorteados com `random`.
- Força = soma das notas do time, com reserva valendo igual a titular (há revezamento), normalizada para 7
  jogadores. Dupla repetida = par de jogadores de linha (inclusive reservas) no mesmo time numa das últimas
  `lookbackRounds` rodadas. Cada rodada conta 1.

**Não faz:**
- Não põe jogador de linha no gol, nem usa `GOALKEEPER` como posição secundária.
- Não põe ninguém em posição fora da principal e das secundárias.
- Não gera time incompleto nem revezamento com menos de 14.
- Não olha histórico de vitórias e não recalcula `rating`.

**Devolve:** `{ ok: true, round: BalancedRound, strength: { WHITE, BLACK }, repeatedPairs }`, onde
`BalancedRound` = `RoundLineup` (válido em `isValidRoundLineup`) + `reserves: { WHITE: string[], BLACK: string[] }`.
Ou `{ ok: false, error }`, com `error` sendo `DUPLICATE_PLAYER`, `NOT_ENOUGH_PLAYERS`, `TOO_MANY_PLAYERS`,
`NOT_ENOUGH_GOALKEEPERS`, `TOO_MANY_GOALKEEPERS` ou `POSITIONS_UNFILLABLE`. **Não lança.**

**Evite:**
- Aleatoriedade sem seed em testes.
- Passar o histórico em ordem invertida (a mais recente primeiro).
- Tratar `strength` como soma crua (é normalizada para 7).
- Fixar λ e os outros pesos fora da config.
- Contar o goleiro nas duplas.

### Nota da rodada, Craque e Perna de Pau: `roundScore` ✅
**O que é:** nota final de um jogador na rodada = **média aparada** das notas recebidas (descarta a maior e a menor).
Também define quem pode votar em quem e apura Craque e Perna de Pau pelos votos. Pasta `src/round-score/`.
**Regras:** só quem jogou vota (goleiros inclusos), em qualquer jogador que jogou (dos dois times); ninguém vota
em si mesmo; quem vota dá nota a **todos** os avaliáveis (`rateablePlayers`) e manda o pacote inteiro (notas +
Craque + Perna de Pau); votos anônimos para jogadores, média pública.

**Fluxo:** validar → calcular. `parseRatings`/`parseBallots` validam e "carimbam"; `roundScore`/`tallyAwards` só
aceitam o que foi carimbado (passar array cru não compila). Calcule as notas antes de apurar os prêmios.

**Assinaturas:**
- `parseRatings(ratings: readonly number[]): Result<ValidRatings, RatingIssue>`,
  com `RatingIssue = { index, value, code: RatingError }`.
- `roundScore(ratings: ValidRatings, { trim = 1, minRatingsToTrim = 4, decimals = 1 }: RoundScoreOptions = {}): number | null`
  `trim` = quantas notas descartar de cada ponta; `minRatingsToTrim` = a partir de quantas notas apara;
  `decimals` = casas do arredondamento.
- `validateVote(voterId: string, targetId: string, playedIds: readonly string[]): VoteError | null`
  `VoteError` (lista em `VOTE_ERRORS`): `'VOTER_DID_NOT_PLAY'`, `'SELF_VOTE'`, `'TARGET_DID_NOT_PLAY'`, nessa prioridade.
- `canVoteFor(voterId, targetId, playedIds): boolean` (versão sim/não de `validateVote`).
- `rateablePlayers(voterId: string, playedIds: readonly string[]): string[]`
- `validateAwardBallot(ballot: AwardBallot, playedIds: readonly string[]): BallotIssue[]`,
  com `AwardBallot = { voterId, mvpId, flopId }` (`mvp` = Craque, `flop` = Perna de Pau) e
  `BallotIssue = { voterId, field: 'voterId' | 'mvpId' | 'flopId', code: BallotError }`.
  `BallotError` (lista em `BALLOT_ERRORS`) = os de `VoteError` + `'SAME_PLAYER_BOTH'` + `'DUPLICATE_VOTER'`.
- `isValidAwardBallot(ballot, playedIds): boolean` (versão sim/não).
- `validateRatingSheet(voterId: string, ratings: readonly RatingEntry[], playedIds: readonly string[]): RatingSheetIssue[]`,
  com `RatingEntry = { targetId, value }` e `RatingSheetIssue = { targetId, code: RatingSheetError }`.
  `RatingSheetError` (lista em `RATING_SHEET_ERRORS`) = os de `VoteError` + os de `RatingError` + `'MISSING_RATING'`
  + `'DUPLICATE_TARGET'`. `isValidRatingSheet(...)` é a versão sim/não.
- `validateRoundVote(vote: RoundVote, playedIds): { ratings: RatingSheetIssue[]; awards: BallotIssue[] }`, com
  `RoundVote = AwardBallot & { ratings: RatingEntry[] }` (o pacote). `isValidRoundVote(...)` é a versão sim/não.
- `parseBallots(ballots: readonly AwardBallot[], playedIds: readonly string[]): Result<ValidBallots, BallotIssue>`
- `tallyAwards(ballots: ValidBallots, options: AwardOptions): AwardResult`, com
  `AwardOptions = { tieBreak?: 'ROUND_SCORE' (padrão); roundScores: Record<playerId, number | null> } | { tieBreak: 'SHARE' | 'NONE' }`.
  `options` é obrigatório: o desempate padrão sem `roundScores` não compila.

**Faz:**
- `roundScore`: com 4 notas ou mais, descarta as `trim` maiores e menores e tira a média do resto; com 3 ou menos
  faz a média simples (aparar deixaria uma pessoa decidindo a nota). Arredonda (meio para cima: 7,25 → 7,3).
- `validateVote`/`canVoteFor`/`rateablePlayers`: aplicam a regra de voto; `rateablePlayers` lista quem o votante deve avaliar.
- `validateAwardBallot`: voto obrigatório em Craque **e** Perna de Pau, em jogadores diferentes, ambos votáveis. Lista
  todos os problemas do voto; se o votante não jogou, devolve só esse.
- `validateRatingSheet`: a folha de notas de um votante cobre todos os avaliáveis, sem repetir alvo, sem nota para
  si mesmo ou para quem não jogou e com notas válidas. Lista todos os problemas (na ordem da folha, depois os que
  faltaram como `MISSING_RATING`); se o votante não jogou, devolve só esse.
- `validateRoundVote`: valida o pacote (folha de notas + `validateAwardBallot`), com os problemas separados. Se o
  votante não jogou, `VOTER_DID_NOT_PLAY` vem uma vez só, em `ratings`.
- `parseBallots`: valida todos os votos e marca o segundo voto da mesma pessoa como `DUPLICATE_VOTER`.
- `tallyAwards`: mais votado leva. Empate: `ROUND_SCORE` (padrão) dá o Craque à maior nota da rodada e o Perna de Pau
  à menor; quem não tem nota perde o desempate; se a nota empatar (ou ninguém tiver nota), todos levam.
  `SHARE` = todos os empatados levam; `NONE` = ninguém leva.

**Não faz:** não lança erro; não controla prazo nem abertura/fechamento da votação; não guarda votos (recebe ids);
não exige que todos votem (só que quem vota avalie todos); não diz se ainda dá para votar ou editar (`isVotingOpen`,
em `src/round`); não tem texto de UI (mensagens em `RATING_ERROR_LABELS`/`BALLOT_ERROR_LABELS`/`RATING_SHEET_ERROR_LABELS` no shared).

**Devolve:** `roundScore` → nota arredondada, ou `null` sem notas (`null` ≠ nota 0). `parse*` → `Result` com todos
os problemas. `validate*` → código(s) de erro com o campo, para a borda montar a mensagem. `tallyAwards` →
`{ mvpIds, flopIds }`, listas em ordem alfabética (várias pessoas no empate compartilhado; vazias sem votos ou com `NONE`).

**Evite:** média simples com 4 notas ou mais (deixa passar "voto de sacanagem"); tratar `null` como 0 no ranking; apurar prêmios antes
de calcular as notas da rodada; ignorar voto inválido em silêncio; aceitar folha de notas parcial ou notas sem
Craque/Perna de Pau (o voto é um pacote); converter para `ValidRatings`/`ValidBallots` com
`as` fora do `parse*` (fura o carimbo); passar `playedIds` com quem só confirmou presença e não jogou.

### Cartola: `cartolaPoints` / `priceVariation` / `validateCartolaSquad` ✅
**O que é:** as regras do Cartola da pelada (`src/cartola/`): pontos de um jogador escalado na rodada,
variação de preço depois da rodada e validação da escalação de um participante (1-2-3-1, orçamento, capitão).

**Fluxo:** `parseCartolaScouts` valida e carimba os scouts → `cartolaPoints` (só aceita scouts carimbados) →
`priceVariation` com os pontos **sem** capitão. A nota vem de `roundScore` (ou da referência, se for `null`).

**Assinaturas:**
- `parseCartolaScouts(scouts: CartolaScouts): Result<ValidCartolaScouts, CartolaScoutIssue>`, com
  `CartolaScouts = { played, goals, assists, result: 'WIN' | 'DRAW' | 'LOSS', mvp, flop, playedAsGoalkeeper, goalsConceded }`
  (`mvp` = Craque, `flop` = Perna de Pau) e `CartolaScoutIssue = { field: 'goals' | 'assists' | 'goalsConceded', value, code }`.
  `CartolaScoutError` (lista em `CARTOLA_SCOUT_ERRORS`): `'INVALID_COUNT'` (negativo, fracionado ou não numérico).
- `cartolaPoints(scouts: ValidCartolaScouts, rating: CartolaRating, { captain = false, config }: CartolaPointsOptions = {}): number`
  - `rating = { round: number | null, reference: number }`: `round` é a saída de `roundScore` (1 casa);
    `reference` é o `Player.rating`, usado quando ninguém deu nota ao jogador.
  - `config: Partial<CartolaScoringConfig>` sobre `DEFAULT_CARTOLA_SCORING`: `goal` 3, `assist` 2, `win` 1,
    `draw` 0, `mvp` 3, `flop` −2, `cleanSheet` 2, `goalConceded` −0,5, `captainMultiplier` 1,5.
- `priceVariation(price: number, points: number | null, config: Partial<CartolaPriceConfig> = {}): PriceVariation`
  - `config` sobre `DEFAULT_CARTOLA_PRICE`: `k` 0,5, `factor` 0,3, `maxChangeRatio` 0,1 (±10%), `minPrice` 3.
  - `points = null` quando o jogador não jogou.
- `validateCartolaSquad(squad: CartolaSquad, { players, budget = CARTOLA_INITIAL_BUDGET }: CartolaMarket): CartolaSquadError[]`
  - `squad = { picks: TeamLineup, captainId }`; `players: ReadonlyMap<playerId, CartolaMarketPlayer>`, com
    `CartolaMarketPlayer = { price, primaryPosition, secondaryPositions }`; `budget` = patrimônio (padrão C$ 100).
  - `CartolaSquadError` (lista em `CARTOLA_SQUAD_ERRORS`): `'INVALID_FORMATION'`, `'UNKNOWN_PLAYER'`,
    `'POSITION_NOT_ALLOWED'`, `'OVER_BUDGET'`, `'CAPTAIN_NOT_IN_SQUAD'`.
- `canPickForPosition(player, position): boolean`: se o jogador pode ocupar a vaga.
- `isValidCartolaSquad(squad, market): boolean` (versão sim/não) e `squadCost(picks, players): number`.

**Faz:**
- `cartolaPoints`: nota (da rodada ou de referência) + gols/assistências + resultado + Craque/Perna de Pau. Se
  `playedAsGoalkeeper`, soma `cleanSheet` com 0 gols sofridos, senão `goalConceded` × gols sofridos. O capitão
  multiplica o total (inclusive negativo). `played: false` → `0`, mesmo para o capitão.
- `priceVariation`: esperado = preço × k; variação = (pontos − esperado) × fator, limitada a ±`maxChangeRatio`
  do preço; novo preço = max(`minPrice`, preço + variação). Com `points = null`, o preço congela.
- `validateCartolaSquad`: checa `matchesFormation`, jogador no mercado, jogador numa vaga permitida, custo ≤ `budget`
  e capitão entre os escalados; lista **todos** os problemas (jogador fora do mercado não gera erro de posição).
- `canPickForPosition`: vaga de linha aceita a posição principal ou uma secundária do cadastro (o admin define;
  normalmente 2 posições por jogador). Vaga de goleiro só para quem tem `GOALKEEPER` como principal, e goleiro
  não entra em vaga de linha (igual ao `balanceTeams`). A vaga **não muda os pontos**: só limita a escalação.

**Não faz:** não lança erro; não soma a pontuação do time inteiro; não define preços iniciais; não abre/fecha
mercado; não dá desconto para quem joga na secundária; não
valida `price`, nota nem config (vêm do sistema, de `roundScore`/`Player` e do schema do shared na borda);
não tem texto de UI (mensagens em `CARTOLA_SCOUT_ERROR_LABELS`/`CARTOLA_SQUAD_ERROR_LABELS` no shared).

**Devolve:** `cartolaPoints` → pontos com 2 casas. `priceVariation` → `{ expected, variation, newPrice }` com 2
casas; `variation` é a mudança real (já com limite e piso). `parseCartolaScouts` → `Result` com todos os
problemas. `validateCartolaSquad` → lista de códigos (vazia = válida). `squadCost` soma só jogadores do mercado.

**Evite:**
- Pesos e parâmetros fixos no código (vêm da config do grupo).
- Passar a pontuação **com** capitão para `priceVariation` (o preço é do jogador).
- Passar `0` em vez de `null` para quem faltou (o preço cairia em vez de congelar).
- Tratar nota `null` como 0 (use a de referência).
- Aplicar as regras de goleiro pela vaga do Cartola em vez de por quem jogou no gol na partida.
- Converter para `ValidCartolaScouts` com `as` fora do `parse*`.
- Arredondar fora daqui com outra precisão.

### Rodada, placar e scouts: `validateRoundTransition` / `validateMatchEvent` / `shouldCloseVoting` ✅
**O que é:** as regras de uma rodada (`src/round/`). Rodada = um encontro semanal = **uma partida** (Branco x Preto);
notas, Craque e Perna de Pau são por rodada. Aqui ficam o ciclo (`RoundStatus`), o placar, os scouts (lances)
e quando a votação fecha sozinha.

**Tipos:**
- `RoundStatus` (lista em `ROUND_STATUSES`, igual ao enum do Prisma): `SCHEDULED` (agendada) →
  `TEAMS_PUBLISHED` (times publicados) → `IN_PROGRESS` (em jogo) → `VOTING` (votação) → `CLOSED` (encerrada).
  Para onde cada um pode ir: `ROUND_TRANSITIONS`.
- `MatchEventType` (lista em `MATCH_EVENT_TYPES`): `GOAL`, `ASSIST`, `OWN_GOAL` (gol contra). **`OWN_GOAL` ainda
  não está no enum do Prisma** (`MatchEventType`): entra no PR da API que usar estas regras.
- `MatchEvent = { playerId, type }`: quem fez o lance (no banco, `MatchEvent.membershipId`).
- `MatchScore = { WHITE, BLACK }`: placar (no banco, `whiteGoals`/`blackGoals`).
- `RoundTeams` = `RoundLineup` + `reserves: TeamReserves` (mesmo formato do `BalancedRound`). Quem está aqui jogou.
- `RoundState = { status, teams: RoundTeams | null, score: MatchScore | null, events: MatchEvent[] }`:
  o que as regras precisam da rodada (`null` = ainda não montado/lançado).
- `RoundActor = { id, isAdmin }`: quem está agindo. O domínio não conhece usuário: a API diz se é admin do grupo.

**Assinaturas:**
- `validateRoundTransition(round: RoundState, to: RoundStatus, { maxReservesPerTeam = MAX_RESERVES_PER_TEAM }: RoundTeamsOptions = {}): RoundTransitionError[]`
  e `canTransitionRound(...)` (sim/não). `RoundTransitionError` (lista em `ROUND_TRANSITION_ERRORS`):
  `'INVALID_TRANSITION'`, `'INVALID_LINEUP'`, `'INVALID_RESERVES'`, `'SCORE_MISSING'`, `'INVALID_SCORE'`,
  `'GOALS_MISMATCH'`, `'TOO_MANY_ASSISTS'`.
- `validateRoundTeams(teams: RoundTeams | null, options?): RoundTransitionError[]` (só `INVALID_LINEUP`/`INVALID_RESERVES`).
- `isRoundDeletable(status): boolean` e `isRoundEditable(status): boolean` (data, hora e local).
- `validateMatchEvent(event: MatchEvent, actor: RoundActor, round: RoundState): MatchEventError[]` e
  `canLaunchMatchEvent(...)` (sim/não); `validateMatchEventRemoval(event, actor, round): MatchEventError[]`.
  `MatchEventError` (lista em `MATCH_EVENT_ERRORS`): `'ROUND_NOT_OPEN'`, `'NOT_OWN_EVENT'`,
  `'PLAYER_DID_NOT_PLAY'`, `'GOALS_EXCEED_SCORE'`, `'ASSISTS_EXCEED_SCORE'`.
- `validateScoreEntry(score: MatchScore, actor: RoundActor, round: RoundState): ScoreEntryError[]`.
  `ScoreEntryError` (lista em `SCORE_ENTRY_ERRORS`): `'ROUND_NOT_OPEN'`, `'NOT_ADMIN'`, `'INVALID_SCORE'`,
  `'SCORE_BELOW_GOALS'`, `'SCORE_BELOW_ASSISTS'`.
- `isMatchOpen(status): boolean`: se scouts e placar podem ser lançados/corrigidos.
- `isVotingOpen(status: RoundStatus, now: Date, voting: VotingState): boolean`: se dá para votar **ou editar** o voto.
- `votingCloseReason(now: Date, voting: VotingState): VotingCloseReason | null` e `shouldCloseVoting(now, voting): boolean`,
  com `VotingState = { openedAt, deadlineHours, playedIds, votedIds }` e `VotingCloseReason` (lista em
  `VOTING_CLOSE_REASONS`) = `'ALL_VOTED'` | `'DEADLINE_PASSED'`. `votingDeadline(openedAt, deadlineHours): Date`.
- Apoio: `teamOf(playerId, teams)`, `roundPlayerIds(teams)` (os `playedIds` das notas),
  `tallyMatchEvents(events, teams)` → `{ goals, assists }` por time, `validateScore(score)` → `'INVALID_SCORE'` | `null`.

**Faz:**
- **Ciclo:** só anda para frente, com uma volta: `TEAMS_PUBLISHED` → `SCHEDULED` (despublicar para refazer os times).
  `CLOSED` é definitivo (votação não reabre). Pré-condições: publicar times e começar o jogo exigem `RoundTeams`
  válido (`isValidRoundLineup` + até `maxReservesPerTeam` reservas por time, sem repetir ninguém nem titular);
  ir para `VOTING` e para `CLOSED` exigem times montados (sem eles, `INVALID_LINEUP`), placar lançado e válido, **gols lançados = placar** em cada time
  (gol contra conta para o adversário) e assistências ≤ gols do time. Etapa inválida devolve só `INVALID_TRANSITION`.
- **Cancelar:** não há status de cancelada. Rodada que não vai acontecer é apagada, e só antes do jogo
  (`SCHEDULED` ou `TEAMS_PUBLISHED`, `isRoundDeletable`).
- **Scouts:** lança e apaga só em `IN_PROGRESS` e `VOTING`; em `CLOSED` congela (notas, prêmios e Cartola já saíram).
  Jogador lança/apaga só os próprios; admin, de qualquer um. Quem fez o lance tem que ter jogado (titular ou reserva).
  Corrigir = apagar + lançar. Assistência é solta (não aponta para um gol). Sem placar, não há limite; com placar,
  os gols de um time não passam do placar dele, nem as assistências.
- **Placar:** só admin, em `IN_PROGRESS` e `VOTING`; não fica abaixo dos gols nem das assistências já lançados.
  Gols podem ser lançados antes do placar.
- **Votação:** fecha sozinha quando todos que jogaram votaram (`ALL_VOTED`, tem prioridade; com `playedIds`
  vazio não vale, só o prazo fecha) ou quando o prazo expira (`DEADLINE_PASSED`, a partir do instante
  `openedAt + deadlineHours`). Votar é opcional: sem votos, fecha no
  prazo. Voto de quem não jogou ou repetido não conta. O admin pode encerrar antes: basta a transição para `CLOSED`.
  `votedIds` = quem mandou o pacote (notas de todos + Craque + Perna de Pau). Votar e editar o voto só com
  `isVotingOpen`: rodada em `VOTING` e votação ainda não fechada; depois que fecha (por qualquer motivo), não muda.

**Não faz:** não lê relógio (`now` vem de fora); não guarda nada nem sabe quem lançou o scout (a API grava
`createdById`); não checa papel no grupo (recebe `isAdmin`); não define o que é "votou" (a API passa `votedIds`);
não fecha a rodada sozinha: `shouldCloseVoting` só diz que é hora, e o `CLOSED` ainda exige placar batendo
(prazo expirado com gols sem bater fica em `VOTING` até o admin acertar); não tem texto de UI
(`ROUND_STATUS_LABELS`, `MATCH_EVENT_TYPE_LABELS`, `ROUND_TRANSITION_ERROR_LABELS`, `MATCH_EVENT_ERROR_LABELS`,
`SCORE_ENTRY_ERROR_LABELS` no shared).

**Devolve:** `validate*` → lista de códigos (vazia = pode); fora de `IN_PROGRESS`/`VOTING`, os de scout e placar
devolvem só `ROUND_NOT_OPEN`. `votingCloseReason` → motivo ou `null` (segue aberta).

**Evite:**
- Gravar gol sofrido como lance (sai do placar); scout sem autor; jogador lançando scout de outro.
- Lançar gol contra como `GOAL` de alguém do outro time (use `OWN_GOAL` de quem fez).
- Contar `OWN_GOAL` como gol do jogador no Cartola ou nas estatísticas (`CartolaScouts.goals` é só `GOAL`).
- Ler `new Date()` dentro do domínio; usar o horário agendado da rodada como `openedAt` (é quando entrou em `VOTING`).
- Pular etapas ou mudar `status` sem `validateRoundTransition`; modelar várias partidas por rodada.
- Passar `Attendance` (confirmados) como `teams` ou `playedIds`.

**API do jogo (`apps/api/src/match`, rotas sob `/api/groups/:groupId/rounds/:roundId/match`):** `GET` (membro) devolve o dia da rodada,
placar, quem jogou, lances e `next` (começar/encerrar, com o motivo do domain quando não dá); `PATCH /status` (admin)
só aceita `IN_PROGRESS` e `VOTING`; `PUT /score` (placar, regra `validateScoreEntry`); `POST /events` e
`DELETE /events/:eventId` (regras `validateMatchEvent`/`validateMatchEventRemoval`). Só `GOAL` e `ASSIST` são aceitos
(`OWN_GOAL` ainda não existe no Prisma). Erro de regra = `{ code, message }`: "não pode ser você" (`NOT_ADMIN`,
`NOT_OWN_EVENT`) vira 403, o resto 409. O lance mostra `createdBy`; desfazer a remoção na tela é lançar de novo (o
autor passa a ser quem desfez).

### Presença: `validateAttendanceChange` 🚧
**O que é:** quem pode marcar Vou / Não vou numa rodada e até quando (`src/round/attendance.ts`). Regras decididas
pelo dono em 23 out 2026.

**Assinaturas:**
- `validateAttendanceChange(playerId: string, actor: RoundActor, status: RoundStatus): AttendanceError[]` e
  `canChangeAttendance(...)` (sim/não). `AttendanceError` (lista em `ATTENDANCE_ERRORS`): `'ATTENDANCE_CLOSED'`,
  `'NOT_OWN_ATTENDANCE'`, `'TEAMS_ALREADY_PUBLISHED'`.
- `isRoundEditable(status)` (em `status.ts`): data, hora e local só mudam antes do jogo, a mesma janela de apagar.

**Faz:**
- **Prazo:** jogador marca **só a própria** presença, e só com a rodada `SCHEDULED`. Com os times publicados
  (`TEAMS_PUBLISHED`), só o admin muda, de qualquer membro (inclusive a dele). Do jogo em diante (`IN_PROGRESS`+),
  trava para todos e devolve só `ATTENDANCE_CLOSED`.
- **Sem limite de confirmados** e sem lista de espera: acima do que o seletor aceita (18), o admin ajusta a lista.
- **Goleiro contratado** é membro como os outros: confirma pelo app, e o admin também pode marcar por ele.
- **Data no passado vale** (criar ou mover): serve para registrar pelada que já aconteceu; não há trava de data.

**Não faz:** não sabe se o alvo é membro ativo do grupo (a API confere: inativo ou de outro grupo → 404);
não lê relógio (o prazo é pelo status, não pela hora marcada); não tem texto de UI (`ATTENDANCE_ERROR_LABELS` no shared).

**Na API** (`apps/api/src/rounds`, rotas sob `/api/groups/:groupId/rounds`): criar (`POST`), editar (`PATCH /:roundId`)
e apagar (`DELETE /:roundId`) são só do admin; listar (`GET`, próximas e passadas pela hora marcada) e detalhe
(`GET /:roundId`, com confirmados, não vão e não responderam, só membros ativos) são de qualquer membro.
Presença: `PUT /:roundId/attendances/:membershipId` com `{ confirmed }`. `NOT_OWN_ATTENDANCE` → 403; os outros
códigos, e rodada fora da janela de editar/apagar (`ROUND_NOT_EDITABLE`/`ROUND_NOT_DELETABLE`), → 409 `{ code, message }`.

**Evite:** deixar o jogador mudar a presença com os times publicados; contar confirmado que ficou inativo;
travar confirmação por número; usar o horário marcado como prazo da presença.

### Grupo, convite e entrada: `toSlug` / `validateNickname` / `validateJoinGroup` / `DEFAULT_INITIAL_RATING` 🚧
**O que é:** regras puras de criar grupo e entrar nele (`packages/domain/src/group`).
- `toSlug(nome)`: minúsculo, sem acento, letras/números separados por hífen (`"Pelada do Zé"` → `pelada-do-ze`);
  nome sem letra nem número vira `pelada`. `nextAvailableSlug(base, ocupados)`: a base, ou o menor sufixo livre a
  partir de 2 (`pelada-2`).
- `validateNickname` (até `NICKNAME_MAX_LENGTH` = 10) e `validateGroupName` (até `GROUP_NAME_MAX_LENGTH` = 50):
  contam caracteres (acento e emoji contam 1), sem os espaços das pontas → `'EMPTY'`, `'TOO_LONG'` ou `null`
  (`TEXT_FIELD_ERRORS`; textos em `NICKNAME_ERROR_LABELS`/`GROUP_NAME_ERROR_LABELS` no shared).
- `validateJoinGroup(participaçãoAtual)`: sem participação ou ativo → `null`; inativo → `'MEMBERSHIP_INACTIVE'`
  (`JOIN_GROUP_ERRORS`; texto em `JOIN_GROUP_ERROR_LABELS`).
- `DEFAULT_INITIAL_RATING` = 6: nota inicial de quem entra (ver Decisões fixas).

**Na API** (`apps/api/src/groups`, contratos em `packages/shared/src/group.ts`):
- `POST /api/groups` `{ name, nickname, primaryPosition }`: cria o grupo com slug único e código de convite; quem
  cria vira `ADMIN` (também jogador, nota 6). Devolve o grupo com `role` e `memberCount`.
- `GET /api/groups/:groupId` e `GET /api/groups/:groupId/members` (membro): o grupo; os membros **ativos** por
  apelido, sem nota (nota é assunto do admin).
- `GET`/`POST /api/groups/:groupId/invite` (admin): vê o código / gera um novo. O antigo deixa de valer na hora.
- `GET /api/invites/:code` (**público**): `{ groupName, memberCount }`. Código inexistente ou trocado → 404.
- `POST /api/invites/:code/join` `{ nickname, primaryPosition }`: entra como `PLAYER`, nota 6 → 201. Já é membro
  ativo → 200 com o grupo, sem duplicar nem mudar os dados. Inativo → 409 `{ code: 'MEMBERSHIP_INACTIVE', message }`.

**Não faz:** editar perfil (foto, secundárias, nota, goleiro contratado, ativo/inativo: `feature/perfil-jogador`);
aprovar entrada (grupo de confiança: tem o link, entra); sair do grupo.
**Evite:** tratar a nota 6 como média medida; reativar membro pelo convite; mostrar membros na prévia pública;
reaproveitar o código antigo depois de gerar um novo; slug como identificador nas rotas (rotas usam `groupId`).

---

## Conceitos ainda não implementados 📋

Já existem como tabelas no banco (`apps/api/prisma/schema.prisma`, enums iguais aos do domain, menos o `OWN_GOAL`), mas ainda
sem regras nem rotas. Rodada e Scout já têm regras (ver "Rodada, placar e scouts" acima).

### Grupo e participação (`Group` / `Membership`)
**O que é:** grupo = uma pelada. Membership = um usuário num grupo, com papel (`ADMIN` ou `PLAYER`) e os dados de
jogador daquele grupo: apelido, foto, posição principal e secundárias, nota inicial (dada pelo admin), se é goleiro
contratado (`isHiredGoalkeeper`) e se está ativo. **Apelido com até 10 letras** (`validateNickname`). Criar grupo e
entrar pelo convite: ver "Grupo, convite e entrada". Um usuário pode estar em vários grupos, com papéis diferentes.
**Admin também é jogador:** tem posição e nota como todo mundo, mais as permissões de admin.
**Acesso ao grupo na API** ✅ (`apps/api/src/auth`): rota com `:groupId` usa `@GroupMember()` (qualquer membro)
ou `@GroupRole('ADMIN')`. Só passa quem tem Membership **ativa** naquele grupo.
- Não membro, membro **inativo** ou grupo inexistente → **404** (não revela que o grupo existe).
- Membro ativo sem o papel pedido → **403**.
- `ADMIN` passa nas rotas de membro (admin também é jogador). `@CurrentMembership()` entrega `{ id, groupId, role }`.
**Evite:** confiar em `groupId` do cliente sem um desses decorators; responder 403 para quem não é membro
(entrega que o grupo existe); conferir o papel em outro grupo do usuário.
**Evite:** qualquer dado de domínio sem `groupId`; checar papel pelo usuário em vez da membership daquele grupo;
usar `isHiredGoalkeeper` como posição (quem joga no gol é quem tem `GOALKEEPER`); apagar membership (desative).

### Presença e escalação (`Attendance` / `TeamPlayer`)
**O que é:** `Attendance` = resposta de presença de um membro na rodada (`confirmed`); sem linha = não respondeu.
`TeamPlayer` = jogador escalado num time da rodada, com a posição e `isReserve`. Quem está no `TeamPlayer` (titular
ou reserva) **jogou**: é a lista de `playedIds` das notas. Por time: 7 titulares e até 2 reservas.
Os times da rodada viram `RoundTeams` no domínio (ver "Rodada, placar e scouts").
Quem marca a presença e até quando: ver "Presença" acima.
**Evite:** usar `Attendance` como "jogou" (confirmou ≠ jogou); o mesmo membro nos dois times.
