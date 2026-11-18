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
- **Voto pode ser alterado enquanto a votação está aberta**: até o prazo (`Group.votingDeadlineHours`, **24 horas**
  contadas de quando o admin abriu, decisão do dono em 14 nov 2026), ou antes, se todos os ativos votarem ou o admin
  encerrar. Fechou, não muda mais (ver "Votação, fechamento e resultado").
- **Apelido com até 10 letras** (regra do `Membership`; `validateNickname`, ver "Grupo, convite e entrada").
- **Nota inicial padrão 6** (dono, 23 out 2026): quem entra no grupo (pelo convite ou criando) começa com nota 6,
  só como referência visual e ponto de partida do seletor, até o admin ajustar no perfil. A primeira média medida
  de fato sai da primeira rodada que o jogador completar e receber votos.
- **Convite não reativa membro** (dono, 23 out 2026): membro desativado pelo admin que usa o link recebe erro e
  precisa falar com o admin. Reativar é do admin (no Elenco: `PATCH` com `active: true`).
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
(usadas quando falta gente na principal) e `rating` (a **nota de referência**: média das 5 últimas notas de rodada,
com a inicial do admin completando; ver "Ranking pela nota". Sem rodada com nota, é a inicial).
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
editar antes de publicar. Agora também olha **vitórias** (panelinha).
**Assinatura:** `balanceTeams(players: readonly Player[], history: readonly PastRound[] = [], config: Partial<BalanceTeamsConfig> = {}, options: { avoid?: PastRound } = {})`.
- `history`: rodadas anteriores, **da mais antiga para a mais recente**. `PastRound` = `RoundLineup` + `reserves?` +
  `score?: MatchScore | null` (sem placar, a rodada não conta na panelinha).
- `options.avoid`: a divisão de agora (o Regerar). Compara só **quem está com quem**, ignorando lado e posição.
- `config` (defaults em `DEFAULT_BALANCE_TEAMS_CONFIG`; pesos calibrados na simulação de 25 out 2026, recalibrar
  com dados reais; `pnpm --filter @fut-stats/api simular:seletor`):
  - `repeatedPairWeight` (λ) = `0.02`: custo por unidade de repetição em excesso, **em média de nota**.
  - `recencyWeights` = `[1, 0.75, 0.5, 0.25]`: peso das últimas rodadas (mais recente primeiro); o tamanho da lista é a
    janela. Substitui `lookbackRounds`.
  - `cliqueWeight` (μ) = `0.05` e `cliqueRecencyWeights` = 10 pesos `1 − 0.09·k`: panelinha.
  - `cliqueMarginCap` = `4`: diferença de gols a partir da qual a vitória pesa o máximo.
  - `tolerance` (τ) = `0.1`: folga sobre o melhor custo; o sorteio é entre as divisões dentro dela.
  - `offPositionFactor` = `0.9`: multiplica a nota de quem joga na posição secundária.
  - `maxReservesPerTeam` = `MAX_RESERVES_PER_TEAM` (2).
  - `random` = `Math.random`: sorteio. Use `seededRandom(seed)` (exportado) para ter determinismo.

**Faz:**
- Aceita de 14 a `14 + 2 · maxReservesPerTeam` confirmados (18 por padrão), com **exatamente 2 goleiros**
  (`primaryPosition === 'GOALKEEPER'`), um em cada time.
- Quem passa de 14 vira reserva de um time, com no máximo 1 de diferença de reservas entre os times.
- Jogador de linha joga na posição principal ou numa secundária, com o **mínimo possível** fora da principal
  (a posição vem antes do custo).
- Custo = `|média Branco − média Preto| + λ · repetição em excesso + μ · panelinha` (tudo em média de nota),
  testando **todas** as divisões possíveis.
  - Repetição em excesso, por dupla de linha (reservas incluídos): `max(0, Σ peso · juntos − Σ peso · chance de
    cair junto)` nas rodadas da janela. Chance de cair junto = `(tamanho do time de linha − 1) / (total de linha − 1)`.
  - Panelinha, por dupla de linha: `saldo = Σ peso · ±min(diferença de gols, cap) / cap` nas rodadas com placar
    (`+` venceram no mesmo time, `−` perderam juntos, `0` empate ou sem placar); entra como `max(0, saldo)`.
    A janela da panelinha (`cliqueRecencyWeights`) conta só rodadas **com placar**: rodada sem placar não ocupa lugar nela.
    A janela da repetição (`recencyWeights`) conta as últimas rodadas, com ou sem placar.
- Sorteia entre as divisões com custo até melhor + τ e, com `avoid`, descarta a divisão a evitar se houver outra.
  Com `tolerance: 0` volta ao comportamento antigo (só as de custo mínimo).
- Média do time = soma das notas ÷ jogadores (reserva vale igual a titular).

**Não faz:**
- Não põe jogador de linha no gol, nem usa `GOALKEEPER` como posição secundária.
- Não põe ninguém em posição fora da principal e das secundárias.
- Não gera time incompleto nem revezamento com menos de 14.
- Goleiro não entra em dupla repetida nem em panelinha.
- Não recalcula `rating`.

**Devolve:** `{ ok: true, round: BalancedRound, strength: { WHITE, BLACK }, repeatedPairs }`. `strength` segue sendo a
soma normalizada para 7 jogadores; `repeatedPairs` é a contagem crua de duplas do mesmo time na janela de
`recencyWeights`. `BalancedRound` = `RoundLineup` (válido em `isValidRoundLineup`) + `reserves`.
Ou `{ ok: false, error }`, com `error` em `BALANCE_TEAMS_ERRORS` (`DUPLICATE_PLAYER`, `NOT_ENOUGH_PLAYERS`,
`TOO_MANY_PLAYERS`, `NOT_ENOUGH_GOALKEEPERS`, `TOO_MANY_GOALKEEPERS`, `POSITIONS_UNFILLABLE`). **Não lança.**

**Evite:**
- Aleatoriedade sem seed em testes; testes de custo exato sem `tolerance: 0`.
- Passar o histórico em ordem invertida (a mais recente primeiro).
- Fixar λ, μ e os outros pesos fora da config.
- Contar o goleiro nas duplas.

### Equilíbrio dos times: `teamBalance` ✅
**O que é:** média de nota de Branco e Preto e se a diferença está boa. Mostrada no card de equilíbrio da tela de
montar (o front chama `draftBalance` do shared, que converte o rascunho e chama esta função).
**Assinatura:** `teamBalance(teams: RoundTeams, players: readonly Pick<Player, 'id' | 'primaryPosition' | 'rating'>[], config: Partial<TeamBalanceConfig> = {})`.
- `config` (`DEFAULT_TEAM_BALANCE_CONFIG`): `offPositionFactor` = `0.9`, `balancedThreshold` = `0.5`.

**Faz:**
- Média de cada time = soma das notas ÷ jogadores no time (titulares e reservas), em 2 casas.
- Titular fora da posição principal vale nota × 0,9, **esteja ou não nas secundárias**. Reserva vale a nota cheia.
- `difference` = |média Branco − média Preto| **arredondada em 1 casa** (o número que a tela mostra; as médias seguem
  em 2 casas). `balanced` e `stronger` comparam esse valor arredondado: `balanced` = diferença ≤ 0,5 (0,54 vira 0,5 e
  é equilibrado); `stronger` = o time mais forte quando não está equilibrado.
- Jogador que não está em `players` é ignorado.

**Devolve:** `{ average: { WHITE, BLACK }, difference, balanced, stronger }`. Time vazio: média `null` e
`difference`, `balanced` e `stronger` `null` (sem comparação).

**Evite:** usar a força normalizada do `balanceTeams` aqui (é outra escala); contar a posição secundária como
posição principal.

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

### Faixa da carta: `cardTier` ✅
**O que é:** a faixa (bronze, prata ou ouro) da carta de um jogador no pacote do Craque, pela nota da rodada.
Mora em `src/round-score/card-tier.ts` e é reexportada pelo `shared` (o web não importa o domain direto).
**Regras:** nota **< 6** = bronze; **6 a 7,9** = prata; **≥ 8** = ouro. O corte é inclusivo na faixa de cima
(6,0 é prata, 8,0 é ouro). As notas da rodada têm uma casa (`roundScore`), então a comparação `>=` direta é segura.
**Assinatura:** `cardTier(rating: number, cuts: CardTierCuts = DEFAULT_CARD_TIER_CUTS): CardTier`, com
`CardTier = 'bronze' | 'silver' | 'gold'` e `CardTierCuts = { silver, gold }` (padrão `{ silver: 6, gold: 8 }`).
**Configurável:** os cortes entram por `cuts`, sem mexer na função.
**Onde é usada:** moldura e fundo das cartas do pacote do Craque (Craque, Perna de Pau e a carta de quem jogou).
A figurinha do jogador (`/jogadores/:id` e Perfil) também usa a faixa, pela **média do ranking geral
arredondada a 1 casa, como aparece** (`stats.average` → `roundAverage`: 7,96 mostra 8,0 e é ouro), só para quem está
ranqueado (`rank` ≠ `null`); com "Poucos jogos" ou sem média, fica neutra.
**Não faz:** não tem texto nem cor (UI no web); não trata `null`: quem não tem nota (`roundScore` = `null`) não tem
faixa e o chamador nem chama. Não valida a faixa da nota (0 a 10 é do `isValidRating`).

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
  `TEAMS_PUBLISHED` (times publicados) → `IN_PROGRESS` (em jogo) → `POST_MATCH` (Resenha) → `VOTING` (votação)
  → `CLOSED` (encerrada).
  Para onde cada um pode ir: `ROUND_TRANSITIONS`.
- `MatchEventType` (lista em `MATCH_EVENT_TYPES`): `GOAL`, `ASSIST`, `OWN_GOAL` (gol contra). O enum do Prisma
  (`MatchEventType`) tem os mesmos três valores (`domain-enums.spec.ts` garante).
- `MatchEvent = { playerId, type }`: quem fez o lance (no banco, `MatchEvent.membershipId`).
- `MatchScore = { WHITE, BLACK }`: placar (no banco, `whiteGoals`/`blackGoals`).
- `RoundTeams` = `RoundLineup` + `reserves: TeamReserves` (mesmo formato do `BalancedRound`). Quem está aqui jogou.
- `RoundState = { status, teams: RoundTeams | null, confirmedIds: string[], score: MatchScore | null, events: MatchEvent[] }`:
  o que as regras precisam da rodada (`null` = ainda não montado/lançado). `confirmedIds` (obrigatório) = ids de quem
  confirmou presença e segue ativo; a API monta a partir de `Attendance`.
- `RoundActor = { id, isAdmin }`: quem está agindo. O domínio não conhece usuário: a API diz se é admin do grupo.

**Assinaturas:**
- `validateRoundTransition(round: RoundState, to: RoundStatus, { maxReservesPerTeam = MAX_RESERVES_PER_TEAM }: RoundTeamsOptions = {}): RoundTransitionError[]`
  e `canTransitionRound(...)` (sim/não). `RoundTransitionError` (lista em `ROUND_TRANSITION_ERRORS`):
  `'INVALID_TRANSITION'`, `'INVALID_LINEUP'`, `'INVALID_RESERVES'`, `'SCORE_MISSING'`, `'INVALID_SCORE'`,
  `'GOALS_MISMATCH'`, `'ATTENDANCE_MISMATCH'`.
- `validateRoundTeams(teams: RoundTeams | null, options?): RoundTransitionError[]` (só `INVALID_LINEUP`/`INVALID_RESERVES`).
- `validateAttendanceMatch(teams: RoundTeams | null, confirmedIds): RoundTransitionError[]`: `['ATTENDANCE_MISMATCH']` se
  os escalados (titulares e reservas) não forem exatamente os confirmados; sem times, `[]`.
- `validateLineupDraft(draft: RoundTeams, options?): LineupDraftError[]`: confere o **rascunho** dos times (pode estar
  incompleto). `LineupDraftError` (lista em `LINEUP_DRAFT_ERRORS`): `'DUPLICATE_PLAYER'` (ninguém repetido, nem nos dois
  times nem titular e reserva), `'POSITION_FULL'` (posição com mais gente que o 1-2-3-1), `'TOO_MANY_RESERVES'`.
- `isRoundDeletable(status): boolean` e `isRoundEditable(status): boolean` (data, hora e local).
- `isMatchFinished(status): boolean`: o jogo já terminou, da Resenha em diante (`POST_MATCH`, `VOTING`, `CLOSED`). É o que
  entra no **Histórico**; toda rodada assim tem placar. `isRoundPlayed(status): boolean`: já foi jogada, em jogo ou
  finalizada (`IN_PROGRESS` + as finalizadas); o seletor de times usa para o histórico de duplas e a panelinha.
- `validateMatchEvent(event: MatchEvent, actor: RoundActor, round: RoundState): MatchEventError[]` e
  `canLaunchMatchEvent(...)` (sim/não); `validateMatchEventRemoval(event, actor, round): MatchEventError[]`.
  `MatchEventError` (lista em `MATCH_EVENT_ERRORS`): `'ROUND_NOT_OPEN'`, `'NOT_OWN_EVENT'`,
  `'PLAYER_DID_NOT_PLAY'`, `'GOALS_EXCEED_SCORE'`.
- `validateScoreEntry(score: MatchScore, actor: RoundActor, round: RoundState): ScoreEntryError[]`.
  `ScoreEntryError` (lista em `SCORE_ENTRY_ERRORS`): `'ROUND_NOT_OPEN'`, `'NOT_ADMIN'`, `'INVALID_SCORE'`.
- `isMatchOpen(status): boolean`: se os **lances** podem ser lançados/apagados (só `POST_MATCH`).
  `isScoreOpen(status): boolean`: se o **placar** pode ser lançado/corrigido (`IN_PROGRESS`, ao finalizar, e `POST_MATCH`).
- `matchWinner(score: MatchScore): MatchWinner`, com `MatchWinner` (lista em `MATCH_WINNERS`) = `'WHITE'` | `'BLACK'` | `'DRAW'`:
  quem venceu pelo placar (mais gols; igual é empate, inclusive 0 a 0; não há desempate).
- `matchResult(score: MatchScore, team: Team): MatchResult`, com `MatchResult` (lista em `MATCH_RESULTS`) = `'WIN'` | `'LOSS'` | `'DRAW'`:
  o resultado do time pelo placar (o card YOU WIN / YOU LOSE / EMPATE de quem jogou). É o mesmo `MatchResult` do Cartola.
- `isVotingOpen(status: RoundStatus, now: Date, voting: VotingState): boolean`: se dá para votar **ou editar** o voto.
- `votingCloseReason(now: Date, voting: VotingState): VotingCloseReason | null` e `shouldCloseVoting(now, voting): boolean`,
  com `VotingState = { openedAt, deadlineHours, playedIds, votedIds }` e `VotingCloseReason` (lista em
  `VOTING_CLOSE_REASONS`) = `'ALL_VOTED'` | `'DEADLINE_PASSED'`. `votingDeadline(openedAt, deadlineHours): Date`.
- Apoio: `teamOf(playerId, teams)`, `roundPlayerIds(teams)` (os `playedIds` das notas),
  `tallyMatchEvents(events, teams)` → `{ goals, assists }` por time, `validateScore(score)` → `'INVALID_SCORE'` | `null`.

**Faz:**
- **Ciclo:** só anda para frente, com uma volta: `TEAMS_PUBLISHED` → `SCHEDULED` (despublicar para refazer os times).
  `CLOSED` é definitivo (votação não reabre). Pré-condições: publicar times e começar o jogo exigem `RoundTeams`
  válido (`isValidRoundLineup` + até `maxReservesPerTeam` reservas por time, sem repetir ninguém nem titular) e
  **confirmados = escalados** (`ATTENDANCE_MISMATCH`: decisão do dono, "quem confirmou presença jogou"; com 16
  confirmados são 14 titulares + 2 reservas, abaixo de 14 ou acima de 18 não publica). Se a presença mudar depois de
  publicar, os times não mudam sozinhos e `IN_PROGRESS` fica travado até o admin despublicar e acertar. A checagem
  vale só para `TEAMS_PUBLISHED` e `IN_PROGRESS`;
  ir para `POST_MATCH` (finalizar o jogo) exige só **placar lançado e válido** (`SCORE_MISSING`, `INVALID_SCORE`),
  sem exigir gols batendo: a Resenha serve para os jogadores completarem os lances;
  ir para `VOTING` (que só sai de `POST_MATCH`: `IN_PROGRESS` não pula a Resenha) e para `CLOSED` exigem times montados (sem eles, `INVALID_LINEUP`), placar lançado e válido e **gols lançados = placar** em cada time
  (gol contra conta para o adversário). Assistência não entra na conta. Placar baixado abaixo dos gols já lançados
  acusa `GOALS_MISMATCH` aqui, nunca ao lançar o placar. Etapa inválida devolve só `INVALID_TRANSITION`.
- **Cancelar:** não há status de cancelada. Rodada que não vai acontecer é apagada, e só antes do jogo
  (`SCHEDULED` ou `TEAMS_PUBLISHED`, `isRoundDeletable`). `POST_MATCH` trava como `IN_PROGRESS`: não apaga nem edita a rodada.
- **Scouts (placar primeiro, lances depois, decisão do dono, 25 out 2026):** os lances (gol, assistência, gol contra)
  só se lançam e apagam na **Resenha** (`POST_MATCH`). Em `IN_PROGRESS` ninguém lança, nem o admin (`ROUND_NOT_OPEN`: a
  tela do admin em jogo só finaliza com o placar). Em `VOTING` e `CLOSED` congela (quem vota vê números que não mudam;
  notas, prêmios e Cartola dependem deles). Na Resenha o jogador lança/apaga só os próprios (`NOT_OWN_EVENT` nos de
  outro); admin, de qualquer um. Gol contra segue a mesma regra de gol. Quem fez o lance tem que ter jogado (titular ou
  reserva). Corrigir = apagar + lançar. Com placar lançado, os gols de um time não passam do placar dele
  (`GOALS_EXCEED_SCORE`; gol contra conta para o adversário). **Assistência é solta**: não aponta para um gol, não tem
  limite e não trava nada (nem o placar, nem a votação).
- **Placar:** só admin, ao finalizar o jogo (`IN_PROGRESS`) e na Resenha (`POST_MATCH`); congela ao abrir a votação. **Nunca
  é barrado pelos lances**: o admin pode baixá-lo abaixo dos gols já lançados, e a abertura da votação acusa
  `GOALS_MISMATCH` até ele (ou os lances) acertar.
- **Votação:** fecha sozinha quando todos que jogaram votaram (`ALL_VOTED`, tem prioridade; com `playedIds`
  vazio não vale, só o prazo fecha) ou quando o prazo expira (`DEADLINE_PASSED`, a partir do instante
  `openedAt + deadlineHours`). Votar é opcional: sem votos, fecha no
  prazo. Voto de quem não jogou ou repetido não conta. O admin pode encerrar antes: basta a transição para `CLOSED`.
  `votedIds` = quem mandou o pacote (notas de todos + Craque + Perna de Pau). Votar e editar o voto só com
  `isVotingOpen`: rodada em `VOTING` e votação ainda não fechada; depois que fecha (por qualquer motivo), não muda. O resto da votação (prazo de 24 h, apuração gravada, rotas): "Votação, fechamento e resultado".

**Não faz:** não lê relógio (`now` vem de fora); não guarda nada nem sabe quem lançou o scout (a API grava
`createdById`); não checa papel no grupo (recebe `isAdmin`); não define o que é "votou" (a API passa `votedIds`);
não fecha a rodada sozinha: `shouldCloseVoting` só diz que é hora, e o `CLOSED` ainda exige placar batendo
(prazo expirado com gols sem bater fica em `VOTING` até o admin acertar); não tem texto de UI
(`ROUND_STATUS_LABELS`, `MATCH_EVENT_TYPE_LABELS`, `ROUND_TRANSITION_ERROR_LABELS`, `MATCH_EVENT_ERROR_LABELS`,
`SCORE_ENTRY_ERROR_LABELS` no shared).

**Devolve:** `validate*` → lista de códigos (vazia = pode); os de scout e placar
devolvem só `ROUND_NOT_OPEN` (lances: tudo fora de `POST_MATCH`; placar: tudo fora de `IN_PROGRESS`/`POST_MATCH`). `votingCloseReason` → motivo ou `null` (segue aberta).

**Evite:**
- Gravar gol sofrido como lance (sai do placar); scout sem autor; jogador lançando scout de outro.
- Lançar gol contra como `GOAL` de alguém do outro time (use `OWN_GOAL` de quem fez).
- Contar `OWN_GOAL` como gol do jogador no Cartola ou nas estatísticas (`CartolaScouts.goals` é só `GOAL`).
- Ler `new Date()` dentro do domínio; usar o horário agendado da rodada como `openedAt` (é quando entrou em `VOTING`: a API grava `Round.votingOpenedAt` ao abrir a votação).
- Pular etapas ou mudar `status` sem `validateRoundTransition`; modelar várias partidas por rodada.
- Passar `Attendance` (confirmados) como `teams` ou `playedIds`; esquecer `confirmedIds` no `RoundState`; exigir o
  1-2-3-1 completo no rascunho (`validateLineupDraft` aceita incompleto; quem exige é a publicação).

### Rodízio das reservas: `rotationPlan` e `rotationStatus` ✅
**O que é:** o revezamento opcional de reservas durante uma partida em `IN_PROGRESS` (`src/round/rotation.ts`).
O cronômetro usa uma duração em minutos e calcula separadamente as saídas de cada time.

**Tipos e regras:** `RotationPlan` mapeia `WHITE` e `BLACK` a turnos com início, fim e jogadores fora; `RotationStatus`
informa o tempo decorrido/restante, o fim do período e, por time, quem está fora e a próxima troca. A duração padrão é
60 minutos; valores válidos vão de 20 a 120, em passos de 5. Os goleiros não entram na rotação. Reservas de cada time
ficam fora no primeiro turno; depois, titulares de linha são distribuídos em grupos do tamanho da reserva. Cada plano é
estável para a mesma rodada e time. Um time sem reservas tem zero turnos.

**Permissão:** `validateRotationStart(actor, round, minutes)` só aceita admin, rodada em jogo, ao menos uma reserva em
algum time e duração válida. `validateRotationStop(actor, round)` exige admin e jogo em andamento. O domain recebe o
tempo decorrido de quem o chama; não lê o relógio, persiste dados nem define texto visual.

**Evite:** incluir goleiro ou reserva do outro time no plano; criar uma rotação para time sem reserva; usar relógio local
sem compensar `serverTime` na tela.

**Na API** (`apps/api/src/match`, rotas sob `/api/groups/:groupId/rounds/:roundId/match`; contrato em
`packages/shared/src/match.ts`): `GET /` devolve a `MatchView` a qualquer membro (times, lances com `team` = o time que
ganhou o lance, `tally`, `me` com o resultado, `permissions` e `canRemove` calculados com o domain, e `errors` do próximo
passo do admin). Admin: `POST /start` (`TEAMS_PUBLISHED` → `IN_PROGRESS`), `PUT /score`, `POST /finish` (grava o placar
final e vai para `POST_MATCH` numa transação) e `POST /open-voting` (`POST_MATCH` → `VOTING`, grava `votingOpenedAt`).
Lances: `POST /events` e `DELETE /events/:eventId`, de qualquer membro conforme o domain. Erro de regra vem como
`{ code, message }`: quem pode (`NOT_ADMIN`, `NOT_OWN_EVENT`) → 403; momento e números → 409;
rodada, lance ou grupo que não é do usuário → 404. `start`, `finish`, `open-voting` e `score` conferem o admin no
service (não no guard): jogador comum leva 403 `{ code: 'NOT_ADMIN', message }`; quem não é do grupo, 404.
`permissions.launchAny` = admin e `POST_MATCH`; `launchOwn` = jogou e `POST_MATCH`; `setScore` = admin e
`IN_PROGRESS`/`POST_MATCH`. **Trava por rodada:** toda escrita (`start`, `score`, `finish`, `open-voting`, lançar e apagar
lance) roda numa `prisma.$transaction` que começa com `SELECT 1 FROM "Round" WHERE id = $1 AND "groupId" = $2 FOR UPDATE`;
carregar, validar e gravar usam o mesmo `tx`. Dois pedidos na mesma rodada viram fila (o segundo valida em cima do que o
primeiro gravou): dois gols no limite do placar dão um 200 e um 409 `GOALS_EXCEED_SCORE`, lance e `open-voting` juntos
nunca gravam lance depois do `VOTING`, e dois `DELETE` do mesmo lance dão 200 e 404 (nunca 500). Rodadas diferentes não
esperam uma pela outra. Seed: cenários `em-jogo` (placar nulo, sem lances), `resenha` (placar 3x2, parte dos lances), `votacao` e `encerrada` (ver "Votação, fechamento e resultado").

**Histórico** (`apps/api/src/history`, contrato em `packages/shared/src/history.ts`): `GET /api/groups/:groupId/history`
(qualquer membro ativo; não membro, inativo ou outro grupo → 404) lista só as partidas com o jogo finalizado
(`isMatchFinished`), da mais recente para a mais antiga: ordem `(scheduledAt desc, number desc)`. Cada item traz
`number`, `scheduledAt`, `location`, `status`, `score` (sempre presente), `winner` (`matchWinner`) e `me` = `{ team, result }`
do time de quem pede (titular ou reserva; `matchResult`) ou `null` se não jogou. Paginação por cursor: `?limit=` (1 a 50,
padrão 20) e `?cursor=` = o `nextCursor` da página anterior = id da última rodada dela; `nextCursor: null` na última.
Cursor que não é de uma rodada finalizada do grupo → 400 `{ code: 'INVALID_CURSOR', message }`. O detalhe não tem rota
própria: a tela usa `GET .../rounds/:roundId/match` e `GET .../rounds/:roundId/lineup`.

### Votação, fechamento e resultado: `roundResults` / `pickVotingRound` / `pickLatestResult` ✅
**O que é:** o fim do ciclo da rodada: quem jogou manda o pacote de votos, a votação fecha, a API apura e **grava** o
resultado (Craque, Perna de Pau e a nota de cada um). As regras de cada passo já existiam (`validateRoundVote`,
`roundScore`, `tallyAwards`, `votingCloseReason`, ver as seções acima); esta fatia só as **compõe** e liga à API.

**Domain** (`src/round-score/results.ts`, `src/round/current.ts`, `src/round/voting.ts`):
- `roundResults(votes: readonly RoundVote[], playedIds, options?: RoundScoreOptions & { tieBreak?: 'ROUND_SCORE' | 'SHARE' | 'NONE' }): Result<RoundResults, RoundVoteIssue>`,
  com `RoundResults = { players: Record<id, { score: number | null; ratingsCount: number }>; mvpIds: string[]; flopIds: string[] }`.
  Valida todos os pacotes (`validateRoundVote`, mais o mesmo votante duas vezes: `DUPLICATE_VOTER`); se algum for
  inválido, devolve **todos** os problemas e não calcula pela metade. Senão, a nota de cada um que jogou é o
  `roundScore` das notas que recebeu (aparada com 4+, simples com 3 ou menos, `null` sem nota) e o Craque e o Perna de
  Pau vêm do `tallyAwards` com desempate pela nota da rodada. Sem votos: todos sem nota, `mvpIds` e `flopIds` vazios.
  `RoundVoteIssue = { voterId, kind: 'RATING', targetId, code: RatingSheetError } | { voterId, kind: 'AWARD', field, code: BallotError }`.
- `pickVotingRound(rounds)`: a rodada em `VOTING` de data marcada mais recente, ou `null`.
- `pickLatestResult(rounds, now, { highlightDays = RESULT_HIGHLIGHT_DAYS } = {})`: a `CLOSED` que fechou por último,
  desde que tenha fechado há **menos** de 7 dias (`RESULT_HIGHLIGHT_DAYS`; com 7 dias exatos já saiu), ou `null`.
  É o "O resultado saiu" do início. `now` vem de fora.
- `VOTING_END_REASONS` = `ALL_VOTED` | `DEADLINE_PASSED` | `ADMIN_CLOSED` (`VotingEndReason`), igual ao enum do banco
  (`domain-enums.spec.ts`). Os dois primeiros são os automáticos (`VOTING_CLOSE_REASONS`).

**Regras da votação (decisões do dono, 14 nov 2026):**
- **Prazo: 24 horas** (`Group.votingDeadlineHours`), contadas de `Round.votingOpenedAt`; por grupo no banco, sem tela
  para mudar. A migration trocou 48 por 24 nos grupos que existiam.
- **"Todos votaram" conta só quem ainda está ativo.** Quem jogou e foi desativado continua **recebendo** nota (todo
  `TeamPlayer` precisa ser avaliado por quem vota), mas não segura a votação aberta.
- **Anonimato:** nenhuma rota devolve voto de outra pessoa, nem para o admin. Todos veem a contagem
  ("9 de 16 já votaram"); o **admin** vê também **quem falta votar** (nunca o voto).
- **Apuração gravada ao fechar:** no mesmo passo que leva a rodada a `CLOSED`, a API grava em cada `TeamPlayer` a nota
  (`roundScore`, `null` sem nota), `ratingsCount`, `isMvp` e `isFlop`, e na rodada `closedAt` e `votingEndReason`.
  Dali em diante o resultado não muda (nem se o prazo do grupo mudar nem se alguém for desativado).
- **Três caminhos de fechamento, o que vier primeiro:** o último voto (fecha na hora, na mesma transação), o relógio da
  API (`VotingCloser`, a cada `VOTING_CLOSER_INTERVAL_MS`, padrão 60 000; `0` desliga) e quem abre o app depois do
  prazo (`GET /rounds`, `GET .../feed/alerts`, `GET .../voting` e `GET .../voting/result` fecham as vencidas do grupo antes de responder).
  Em produção o despertador (`POST /api/internal/tick`, abaixo) chama o mesmo `VotingService.closeDueVotings(now, groupId?)` de fora,
  e o relógio interno fica desligado lá (`VOTING_CLOSER_INTERVAL_MS=0`).
- **Voto depois do prazo é recusado** (409 `VOTING_CLOSED`) mesmo que ninguém tenha fechado ainda: o `PUT` fecha a
  rodada ali mesmo (`DEADLINE_PASSED`) e responde o 409. O prazo vale pela hora, não por quem acordou o servidor.
- **Sem votos:** a rodada fecha no prazo sem nota e sem prêmio para ninguém (votar é opcional).
- Se o admin encerra quando já era hora de fechar (prazo ou todos votaram), o motivo gravado é o verdadeiro, não `ADMIN_CLOSED`.

**Banco:** `Vote` (um pacote por votante e rodada: `roundId`, `voterId`, `mvpId`, `flopId`; `@@unique([roundId, voterId])`) e
`Rating` (uma nota do pacote: `voteId`, `targetId`, `value`; `@@unique([voteId, targetId])`). Enviar de novo troca
o pacote inteiro numa transação (nenhuma nota antiga sobra). `Round.closedAt` e `Round.votingEndReason`;
`TeamPlayer.roundScore/ratingsCount/isMvp/isFlop`. Enum `VotingEndReason`.

**Na API** (`apps/api/src/voting`, rotas sob `/api/groups/:groupId/rounds/:roundId/voting`; contrato em
`packages/shared/src/voting.ts`):
- `GET /` → `VotingView` (qualquer membro): `players` (todos que jogaram, meu time primeiro e, em cada time, os
  titulares do goleiro ao atacante e depois os reservas), `progress` `{ voted, total }` só de ativos, `deadline`,
  `serverTime`, `pending` (só para o admin em `VOTING`, `null` para jogador), `me` (`played`, o meu `vote`) e
  `permissions` (`vote` = jogou e `isVotingOpen`; `close` = admin e `VOTING`). Antes de `VOTING` responde 200 sem poder votar.
- `PUT /vote` (`SubmitVoteInput`): só quem jogou. Ordem das checagens: etapa (`VOTING_NOT_OPEN`/`VOTING_CLOSED`, 409) →
  prazo (409 `VOTING_CLOSED` e fecha) → jogou (403 `VOTER_DID_NOT_PLAY`) → pacote (400 `{ code, message, issues }`, com
  o `code` do domain: `MISSING_RATING`, `SELF_VOTE`, `INVALID_STEP`, `OUT_OF_RANGE`, `TARGET_DID_NOT_PLAY`,
  `SAME_PLAYER_BOTH`, `DUPLICATE_TARGET`; `issues[]` = `{ path, code, message }`). O corpo é o `submitVoteSchema` com a
  nota só como número, para o passo e a faixa saírem como código do domain.
- `POST /close` (admin, `NOT_ADMIN` 403 no service): fecha com `ADMIN_CLOSED`; fora de `VOTING` → 409 `INVALID_TRANSITION`.
- `GET /result` → `RoundResult` (`CLOSED`; senão 409 `RESULT_NOT_READY`): placar, `mvps`, `flops`, `players` em ordem
  de nota (sem nota por último, depois pelo apelido) com `rank` da rodada (empate divide a posição, como `rankByRating`),
  gols, assistências e gols contra. `votes` = `{ voted: votos enviados, total: quem jogou }`.
- Quem erra de grupo, não é membro ou está inativo → 404; rodada de outro grupo pedida pelo grupo do usuário → 404.
- **Trava por rodada:** `RoundLockService` (`apps/api/src/rounds/round-lock.service.ts`), usada por `match` e `voting`.
  Votar, encerrar e fechar sozinho rodam nela: dois `PUT` do mesmo votante dão dois 200 e um voto só (o último vence);
  o último voto e o `close` juntos fecham a rodada uma vez só (o outro leva 409).
- `GET /rounds` traz `votingId` (`pickVotingRound`) e `lastResult` (`pickLatestResult`); `GET .../history` traz
  `mvps` (Craque(s), com `avatar`) em cada partida `CLOSED` (lista vazia antes).
- **Seed:** `--cenario=votacao` (rodada atual em `VOTING` aberta há 30 min, com parte dos votos; Carlão e Rafa, os admins,
  sem votar) e `--cenario=encerrada` (rodada atual `CLOSED` hoje, com resultado). As 8 rodadas passadas vêm com votos e
  resultado gravado, fechadas por motivos diferentes.

**Evite:** gravar o resultado fora da transação do fechamento; calcular a nota ao ler (o resultado é o gravado);
devolver voto de outra pessoa (nem para o admin); fechar fora do `RoundLockService`; contar quem foi desativado como
"falta votar"; deixar o 409 de prazo vencido desfazer o fechamento (o fechamento é commitado e só depois o erro sai);
mexer no prazo de uma rodada já aberta esperando que o resultado mude.

### Registro de auditoria: `ROUND_LOG_ACTIONS` + `FEED_LOG_ACTIONS` ✅
**O que é:** o histórico de quem mudou **placar, etapa e lance** de uma rodada e de quem escreveu no **feed**
(resenha, comentário, reação): quem fez, o quê, quando, como estava antes e como ficou. Serve para responder "quem
mudou o placar?", "sumiu um gol meu" e, para o dono, "quem apagou essa resenha e o que dizia?". Só o **vocabulário**
mora no domain (`src/round/log.ts`: `ROUND_LOG_ACTIONS` / `RoundLogAction`; `src/feed/log.ts`: `FEED_LOG_ACTIONS` /
`FeedLogAction`; `AUDIT_ACTIONS` junta as duas; juntas, iguais ao enum `AuditAction` do banco, conferido em
`domain-enums.spec.ts`); gravar e ler é da API (`apps/api/src/audit`). Uma tabela só, **`AuditLog`**, do grupo:
`roundId` opcional (apagar a rodada leva as linhas dela, cascade) e `postId` opcional **sem chave estrangeira** (apagar
a resenha não apaga as linhas dela, senão ninguém descobre quem apagou). O contrato da rodada fica em
`packages/shared/src/round-log.ts` (`RoundLogEntry`, `ROUND_LOG_ACTION_LABELS`).

**O que entra** (9 ações): `TEAMS_PUBLISHED`, `TEAMS_UNPUBLISHED`, `MATCH_STARTED`, `SCORE_SET` (lançar ou corrigir o
placar), `MATCH_FINISHED`, `VOTING_OPENED`, `VOTING_CLOSED` (pelo admin, pelo prazo ou porque todos votaram),
`EVENT_LAUNCHED` e `EVENT_REMOVED`.

**Ações do feed** (7, `FEED_LOG_ACTIONS`): `POST_CREATED`, `POST_EDITED`, `POST_DELETED`, `COMMENT_CREATED`,
`COMMENT_DELETED`, `REACTION_SET` (colocar ou trocar) e `REACTION_REMOVED`. O que fica em `before`/`after`:
`POST_CREATED` `null` → `{ postId, title, body }`; `POST_EDITED` `{ postId, title, body }` → `{ postId, title, body }`;
`POST_DELETED` `{ postId, authorId, title, body, reactionCount, commentCount }` → `null`; `COMMENT_CREATED` `null` →
`{ postId, commentId, length }` (sem o texto, que já está no comentário); `COMMENT_DELETED` `{ postId, commentId,
authorId, text }` → `null`; `REACTION_SET` `{ postId, reaction }` (`null` se não tinha) → `{ postId, reaction }`;
`REACTION_REMOVED` `{ postId, reaction }` → `null`. **O texto apagado ou editado fica guardado** (decisão do dono,
16 nov 2026): é uso interno para investigar bug. `PUT` de reação igual à atual, `DELETE` de reação que não existe e
apagar comentário que outro já apagou não mudam nada e **não deixam linha**. Dois `PUT` de reação do mesmo membro ao
mesmo tempo andam um de cada vez (trava por resenha e membro): nunca duas linhas para uma mudança só.

**Sem rota de leitura do feed.** O registro do feed é para o dono, não para o admin do grupo: lê direto no banco por
`requestId`, por usuário ou por resenha (consultas prontas em `docs/operacao/registro.md`). O `GET .../rounds/:roundId/log`
só devolve ações da rodada.

**O que nunca entra:** o **voto** (é anônimo: nem o conteúdo, nem "fulano votou", nem quem votou por último),
presença, rascunho dos times, criar e editar a rodada, o rodízio e **qualquer leitura**. Rota nova de escrita da
rodada ou do feed precisa entrar na lista de auditadas ou na de excluídas de `audit-coverage.spec.ts`, senão o teste
falha.

**Regras (decididas no spec `auditoria-da-rodada`, 14 nov 2026):**
- **Mesma transação da escrita:** a mudança e a linha do registro entram juntas, ou nenhuma das duas (`AuditService.record(tx, ...)`
  dentro do `RoundLockService`). Pedido recusado (403, 404, 409) não deixa linha. O `before` sai do estado carregado
  no `tx`, com a rodada travada.
- **Quem fez:** a participação (`Membership`) de quem pediu. No fechamento da votação, o ator é o admin só quando veio
  de `POST .../voting/close` (mesmo que o motivo real seja o prazo ou "todos votaram"); nos outros caminhos (último
  voto, prazo, relógio, leitura da votação ou **dos avisos do feed** depois do prazo) é **`null`**, para o voto
  continuar anônimo. Todos passam por `closeRound`, que é quem grava. **Linha sem ator não leva `requestId`** (fica
  nulo): o `requestId` do último voto, cruzado com o log de pedido, diria quem votou por último, e o da leitura diria
  quem abriu o app. Só o "Encerrar votação" do admin leva ator e `requestId`.
- **`actorId` nulo é sempre automático, nunca "ator apagado":** a chave para `Membership` é `ON DELETE RESTRICT` (a
  participação só é desativada, o app nunca a apaga; a remoção manual apaga antes o registro do membro, nunca o
  passa para nulo).
- **Só inserção.** Apagar a rodada (só dá antes do jogo) apaga o registro dela junto (cascade).
- **Antes e depois** são um retrato pequeno, sem dado pessoal além do id da participação: `{ status }` nas etapas;
  `{ score }` no placar (`score: null` enquanto ninguém lançou; salvar o mesmo placar de novo não grava linha); `{ status, score }` ao finalizar; `{ eventId, type, playerId }`
  ao lançar lance (`before: null`) e `{ eventId, type, playerId, createdById }` ao apagar (`after: null`);
  `{ status, reason, voted, total }` ao fechar a votação (só contagem).
- **Leitura:** `GET /api/groups/:groupId/rounds/:roundId/log`, só admin (jogador 403; outro grupo ou inativo 404), da
  linha mais antiga para a mais nova, sem tela nesta fatia. O seed grava direto e não gera registro (`[]`).
- **`requestId`:** todo pedido ganha `x-request-id` (**só com `NODE_ENV` `development` ou `test`** o recebido vale, se bater
  com `/^[A-Za-z0-9_-]{8,64}$/`; **em produção, e sem `NODE_ENV`, é sempre um UUID do servidor**, porque o id vai para o
  registro da rodada e para a tag do Sentry e ninguém de fora escolhe o que entra lá; fora disso, um UUID),
  devolvido na resposta, na linha do registro e no log de pedido (uma linha por pedido com `method`, `path` sem query,
  `status`, `durationMs`, `userId` e `groupId`; com `status >= 400` também **`errorCode`**: o `code` do corpo do erro
  (ex. `NOT_OWN_COMMENT`, `INVALID_TRANSITION`), `VALIDATION_FAILED` no 400 de validação do Zod (só no log; o corpo da
  resposta não muda) ou `null` se o erro não tem código; nunca corpo, cookie, email nem nome; `/api/health` fica de fora). Erro
  500 devolve `{ statusCode, message, requestId }` sem a pilha, que só vai para o log. Linha sem ator (fechamento da
  votação pelo último voto, pelo prazo ou pelo relógio) tem `requestId` nulo.

**Evite:** gravar a linha fora da transação da mudança; registrar voto ou rodízio; pôr nome, email ou nota no
`before`/`after` (texto de resenha e comentário é a exceção decidida, só do feed); confiar num `groupId` do cliente (toda leitura filtra pelo grupo da rota); mudar ou apagar linha do
registro (só insere).

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
  (`TEAMS_PUBLISHED`), só o admin muda, de qualquer membro (inclusive a dele). Do jogo em diante (`IN_PROGRESS`+, inclusive a Resenha `POST_MATCH`),
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

**No detalhe da rodada** (`GET /:roundId`): `myMembershipId` (a membership de quem pediu) e `permissions`
(`setOwnAttendance`, `setAnyAttendance`, `edit`, `delete`), calculadas com o domain para o papel e o status. O
front não repete a regra: só habilita ou trava os botões conforme esses campos; `{ code, message }` de erro da API
aparece como aviso. A tela "próxima rodada" é a primeira de `upcoming` (pela hora marcada).

**Evite:** deixar o jogador mudar a presença com os times publicados; contar confirmado que ficou inativo;
travar confirmação por número; usar o horário marcado como prazo da presença.

### Rodada atual: `pickCurrentRound` 🚧
**O que é:** qual rodada o app mostra como "a da vez" no início e na aba Times (`src/round/current.ts`). Decidido pelo
dono em 23 out 2026, para as telas não terem cada uma a sua regra.

**Assinatura:** `pickCurrentRound(rounds: readonly T[], now: Date, options?: { staleAfterHours?: number }): T | null`,
com `T extends RoundAtTime = { status, scheduledAt }`.

**Faz:** a rodada **em jogo** (`IN_PROGRESS` ou `POST_MATCH`, a Resenha, para não sumir do início) vem primeiro (se houver mais de uma, a de horário mais recente). Sem jogo,
a de antes do jogo (`SCHEDULED`/`TEAMS_PUBLISHED`) com o **horário mais cedo**, contando as que passaram do horário há
menos de `staleAfterHours` (padrão 24): no dia da pelada, passou da hora e o admin ainda não começou, ela continua
na tela.

**Não faz:** não lê relógio (`now` vem de fora); não considera `VOTING`/`CLOSED` (o card de votação é da Fase 3).

**Evite:** escolher "a primeira das próximas" na tela (a rodada some do início na hora do jogo); repetir a regra no front.

### Número da rodada: `Round.number` 🚧
**O que é:** o número da rodada dentro do grupo (1, 2, 3...), para a tela mostrar "RODADA 12" e o grupo citar no
WhatsApp. Decidido pelo dono em 23 out 2026: guardado no banco, não contado pela ordem.

**Faz:** quem dá o número é o **banco**: um trigger (`round_assign_number`, migration `round_number`) grava o maior
número do grupo + 1 em todo insert, com lock por grupo (duas rodadas criadas juntas não repetem). Conta a **ordem de
criação**, não a data: pelada antiga registrada depois ganha o próximo número. Apagar a última rodada libera o número;
apagar outra deixa um buraco (raro, só dá para apagar antes do jogo). Rodadas que já existiam foram numeradas pela data.
Sai no `roundSummarySchema` (`number`).

**Não faz:** não renumera; não é regra do `domain` (é identidade do registro).

**Evite:** calcular o número no front ou pela posição na lista; passar `number` no `create` (o trigger sobrescreve).

### Sugestão da rodada nova: `suggestNextRoundDate` 🚧
**O que é:** a data que a rodada nova já traz preenchida (`src/round/schedule.ts`). Decidido pelo dono em 24 out 2026:
o grupo costuma ter dia e hora fixos, mas às vezes muda. Sem configuração de grupo e sem campo novo no banco.

**Assinatura:** `suggestNextRoundDate(last: Date | null, now: Date, options?: { intervalDays?: number }): Date | null`.

**Faz:** mesmo dia da semana e horário da **última rodada criada** (não a mais adiante no calendário: marcou um
domingo agora, a próxima sugestão é domingo), na primeira data depois dela
que ainda não passou (passos de `intervalDays`, padrão 7). Mudou o dia uma vez, a sugestão seguinte acompanha.

**Não faz:** não lê relógio; não fixa dia da semana; não olha fuso (soma dias inteiros, e o Brasil não tem horário de verão).

**Na API:** `GET /rounds` manda `suggestion: { scheduledAt, location } | null` (o local é o da última rodada criada). O
formulário da rodada nova usa a sugestão; sem rodada no grupo, cai em "amanhã às 20h".

**Evite:** fixar um dia da semana; calcular a sugestão no front.

### Ranking pela nota: `rankByRating` 🚧
**O que é:** o ranking do grupo e a nota que o seletor usa (`packages/domain/src/ranking/`). Só conta rodada
**encerrada** (`CLOSED`: é quando a nota e os prêmios estão gravados). Recorte: todas as do grupo, desde o início
(temporada entra com o Cartola, v1.1).

**Funções** (`rankByRating`, `playerStats`, `minRatedGames`, `rankPlayers`, `rankTrend`, `referenceRating`; todas puras; nada lança; arredondamento meio para cima, como `roundScore`):
- `rankByRating(players: readonly { id, rating }[]): Map<string, number>`: maior nota é 1º; empate divide a posição e
  pula a seguinte (1, 2, 2, 4), como tabela de campeonato. Decidido pelo dono em 24 out 2026: a lista de presença
  mostra a nota e a posição de cada um.
- `playerStats(records: readonly PlayerRoundRecord[]): PlayerStats`: as estatísticas do jogador. `PlayerRoundRecord`
  = uma por rodada encerrada que ele jogou, **da mais antiga para a mais recente**: `{ result, goals, assists,
  ownGoals, score, mvp, flop, playedAsGoalkeeper, goalsConceded }`. Devolve `games`, `wins`, `draws`, `losses`,
  `goals`, `assists`, `ownGoals`, `mvps`, `flops`, `ratedGames`, `average` (média das notas, 2 casas; `null` sem nota;
  rodada sem nota conta jogo e não entra na média), `streak` (`{ result, count }`: resultados iguais seguidos no fim da
  lista; `null` sem rodada) e `goalkeeper` (`games`, `conceded`, `cleanSheets`, `concededPerGame` em 2 casas, só das
  rodadas com `playedAsGoalkeeper`; sempre presente, zerado se nunca jogou no gol: quem mostra é a API).
- `minRatedGames(closedRounds, { target = 3 }?)`: `min(3, rodadas encerradas do grupo)`, nunca menos que 1. Assim o
  ranking existe desde a primeira rodada e, da terceira em diante, um jogo bom não põe ninguém na ponta.
- `rankPlayers(players: readonly { id, average, ratedGames }[], { minRatedGames }): Map<string, number | null>`:
  `rankByRating` na `average` de quem tem `ratedGames >= minRatedGames`; os outros ficam `null` (sem posição), mesmo
  com a maior média. Os classificados vêm primeiro no mapa, na ordem do ranking.
- `rankTrend(before, after): Map<string, number | null>`: quantas posições subiu (+) ou desceu (−) entre dois
  rankings (`posição antes − posição depois`). Só entra quem está no `after`; sem posição antes ou depois, `null`.
- `referenceRating(initialRating, roundScores, { window = DEFAULT_REFERENCE_WINDOW (5) }?)`: ver "Nota de referência".

**Nota de referência** (é o `Player.rating`: a que o seletor, o card de equilíbrio e a lista de presença usam):
média das **5 últimas** notas de rodada do jogador, com a **nota inicial do admin completando as que faltam** (com 2
notas: 2 medidas + 3 vezes a inicial, ÷ 5). Sem rodada com nota é a inicial; com 5 ou mais, a inicial não pesa mais.
`roundScores` vem da mais antiga para a mais recente; resultado com 2 casas. É um número diferente da **média do
ranking** (todas as rodadas) de propósito: o ranking premia a história; o seletor quer saber como o jogador está agora.

**Regras do ranking** (respostas do dono, 14 nov 2026):
- **Média** = média simples das notas de rodada, 2 casas para ordenar (a tela mostra 1).
- **Mínimo para classificar:** nota em pelo menos `minRatedGames(rodadas encerradas do grupo)` rodadas; quem tem menos
  aparece depois dos classificados, sem posição ("POUCOS JOGOS").
- **Por posição:** o mesmo ranking, só entre quem tem aquela **posição principal**. Goleiros: quem tem `GOALKEEPER`
  como principal, com os números de goleiro.
- **Gol contra não conta como gol** do jogador. **Goleiro é contado pela vaga em que jogou:** só entram nos números
  de goleiro as rodadas em que foi **titular** na vaga `GOALKEEPER` (reserva não tem vaga fixa); "gols sofridos" = o
  placar do adversário.
- **Tendência:** compara o ranking com e sem a última rodada encerrada (cada um com o mínimo que o grupo tinha
  naquela hora). Sem rodada, ou sem posição antes ou depois, é `null`.
- **Inativos** ficam fora das listas e das posições dos outros (o histórico deles continua nas partidas).

**Na API** (`apps/api/src/ranking`; contrato em `packages/shared/src/ranking.ts`):
- `GET /api/groups/:groupId/ranking` (qualquer membro ativo) → `Ranking`: `closedRounds`, `minRatedGames`, `players`
  (classificados por posição e apelido; depois os de poucos jogos, por jogos e apelido) e `me`. Cada jogador com
  `rank`, `positionRank`, `trend` e `stats` (`goalkeeper` só para quem tem `GOALKEEPER` como principal).
- `GET /api/groups/:groupId/members/:membershipId/stats` → `PlayerProfile` (o jogador do ranking + posições
  secundárias, `isHiredGoalkeeper`, `role`, `referenceRating` e as 5 últimas rodadas que jogou). Membership inativa, de
  outro grupo ou inexistente: 404.
- `RankingService.referenceRatings(groupId, db?)` → `Map<membershipId, nota>` de todo membro do grupo. A lista de
  presença (`GET .../rounds/:roundId`), a escalação (`GET .../lineup`: `rating`, `rank`) e o seletor
  (`POST .../lineup/suggestion`: o `rating` dos jogadores do `balanceTeams`) usam esse mapa no lugar da nota inicial;
  `rank` é a posição por ele. O **roster do admin** continua com a **nota inicial** (`Membership.initialRating`),
  que é o que ele edita.
- Tudo é calculado na leitura, sem tabela de ranking.

**Evite:** ordenar ou numerar o ranking no front; empate com posições diferentes; contar rodada que não está
`CLOSED`; usar a média do ranking no seletor (ou a nota de referência no ranking); mostrar a nota inicial na lista de
presença; contar gol contra como gol.

### Grupo, convite e entrada: `toSlug` / `validateNickname` / `validateJoinGroup` / `compareNicknames` / `isNicknameTaken` / `validatePlayerPositions` / `validateMemberAdminChange` / `DEFAULT_INITIAL_RATING` 🚧
**O que é:** regras puras de criar grupo e entrar nele (`packages/domain/src/group`).
- `toSlug(nome)`: minúsculo, sem acento, letras/números separados por hífen (`"Pelada do Zé"` → `pelada-do-ze`);
  nome sem letra nem número vira `pelada`. `nextAvailableSlug(base, ocupados)`: a base, ou o menor sufixo livre a
  partir de 2 (`pelada-2`).
- `validateNickname` (até `NICKNAME_MAX_LENGTH` = 10) e `validateGroupName` (até `GROUP_NAME_MAX_LENGTH` = 50):
  contam o caractere visível (acento, mesmo decomposto, e emoji com tom ou composto contam 1; com teto de 12 pontos
  de código por caractere, para acento empilhado não burlar o limite; todo caractere precisa ter algo visível), sem os espaços das pontas → `'EMPTY'`,
  `'TOO_LONG'`, `'INVALID_CHARACTERS'` (controle, `\0`, quebra de linha, tab, caractere invisível como espaço de
  largura zero ou inversão de direção, preenchedor Hangul, Braille em branco, ZWJ/tag/acento soltos, ZWJ/tag/seletor
  de variação fora de emoji) ou `null` (`TEXT_FIELD_ERRORS`; textos em
  `NICKNAME_ERROR_LABELS`/`GROUP_NAME_ERROR_LABELS` no shared). O schema do shared grava o texto sem espaço nas
  pontas e em NFC.
- `hasInvalidCharacters(texto)`: a mesma regra de caractere inválido, para a borda (a API usa no caminho das rotas).
- `compareNicknames(a, b)`: ordem alfabética do português, sem ligar para maiúscula e acento; iguais → 0 (com sort
  estável, desempata por quem entrou primeiro). É a ordem da lista de membros.
- `validateJoinGroup(participaçãoAtual)`: sem participação ou ativo → `null`; inativo → `'MEMBERSHIP_INACTIVE'`
  (`JOIN_GROUP_ERRORS`; texto em `JOIN_GROUP_ERROR_LABELS`).
- `DEFAULT_INITIAL_RATING` = 6: nota inicial de quem entra (ver Decisões fixas).
- `isNicknameTaken(apelido, outros)`: o apelido já é de outro? `outros` = apelidos dos **outros membros ativos** do
  grupo (sem o de quem está mudando). Igual = `compareNicknames` 0 (ignora maiúscula e acento), sem os espaços das
  pontas. **Apelido é único no grupo, só entre os ativos** (dono, 14 nov 2026): vale para criar, entrar pelo convite,
  editar e reativar; inativo não prende apelido.
- `validatePlayerPositions(principal, secundárias, { maxSecondaries = MAX_SECONDARY_POSITIONS }?)`: lista **todos** os
  problemas, sem repetir código, na ordem de `PLAYER_POSITIONS_ERRORS` (`'SECONDARY_IS_PRIMARY'`, `'DUPLICATE_SECONDARY'`,
  `'GOALKEEPER_AS_SECONDARY'`, `'GOALKEEPER_HAS_SECONDARY'`, `'TOO_MANY_SECONDARIES'`); vazia = válida. Até 2
  secundárias (`MAX_SECONDARY_POSITIONS`), sem repetir, diferentes da principal e nunca `GOALKEEPER`; quem tem
  `GOALKEEPER` como principal não tem secundária (o seletor não põe goleiro na linha nem jogador de linha no gol).
  Textos em `PLAYER_POSITIONS_ERROR_LABELS` (shared).
- `validateMemberAdminChange(quemAge, alvo, { role?, active? })`: `['SELF_CHANGE']` se o admin muda o **próprio** papel
  ou o próprio ativo (campo presente = mudança; quem chama tira o que não muda); `[]` caso contrário, inclusive para a
  própria nota inicial e o goleiro contratado. Assim o grupo sempre tem pelo menos um admin ativo. O grupo pode ter
  mais de um admin. Texto em `MEMBER_ADMIN_CHANGE_ERROR_LABELS` (shared).
- **Bonequinho:** ver a entrada "Bonequinho: `PlayerAvatar`" abaixo.

**Na API** (`apps/api/src/groups`, contratos em `packages/shared/src/group.ts`):
- `GET /api/me` e as respostas de grupo trazem, em cada grupo, o `role` e o `membershipId` do usuário (para a tela
  achar "você" nos times e nas listas).
- `POST /api/groups` `{ name, nickname, primaryPosition, avatar? }`: cria o grupo com slug único e código de convite;
  quem cria vira `ADMIN` (também jogador, nota 6). Sem `avatar`, entra o `DEFAULT_AVATAR`. Devolve o grupo com `role`,
  `membershipId`, `nickname` e `avatar` de quem pediu e `memberCount`.
- `GET /api/groups/:groupId` e `GET /api/groups/:groupId/members` (membro): o grupo; os membros **ativos** por
  apelido em ordem alfabética do português (ignora maiúscula e acento; empate por quem entrou primeiro), sem nota
  (nota é assunto do admin), com `avatar`.
- `GET /api/groups/:groupId/members/:membershipId` (membro): um `Member`. Inativo: só o admin vê (para os outros, 404);
  id de outro grupo → 404.
- `GET /api/groups/:groupId/roster` (**admin**, 403 para jogador): o Elenco, todos os membros (ativos primeiro, em cada
  bloco por apelido) como `RosterMember` = `Member` + `initialRating` + `active`.
- `PATCH /api/groups/:groupId/members/:membershipId` (o próprio ou admin) `UpdateMemberInput` (só o que muda):
  `nickname`, `avatar`, `primaryPosition` e `secondaryPositions` são do perfil; `initialRating`, `isHiredGoalkeeper`,
  `role` e `active` só do admin. Responde `RosterMember` (admin) ou `Member` (o próprio, jogador comum). Tudo roda
  numa transação que trava a linha do grupo (`SELECT 1 FROM "Group" WHERE id = $1 FOR UPDATE`) e lê o papel de quem
  pede com a trava (dois admins se rebaixando ao mesmo tempo: um passa, o outro já não é admin). Ordem das checagens:
  alvo no grupo (404) → o próprio ou admin (403 `NOT_OWN_PROFILE`) → campo de admin vindo de jogador (403 `NOT_ADMIN`,
  mesmo que o valor seja o atual) → `validateMemberAdminChange` (409 `SELF_CHANGE`; repetir o valor de agora não é
  mudança) → posições com o estado final, só se o pedido mexe nelas (400, `issues` com os textos do shared) → apelido
  único (409 `NICKNAME_TAKEN`, só se o membro termina ativo e o apelido é novo ou ele está sendo reativado). Falhou
  uma checagem: nada é gravado, nem os campos permitidos do mesmo pedido. **Remover = `active: false`**: a participação
  nunca é apagada.
- **Jogador nunca é apagado** (dono, 17 nov 2026): o grupo tem mensalistas e avulsos que vão de vez em quando; o
  admin desativa e reativa quem não vai jogar por um tempo, e o app não tem caminho que apague `Membership`. Remover
  de verdade (testes, ou quem nunca mais vai jogar ou está desativado há muito tempo) é feito à mão no banco, pelo
  orquestrador, seguindo `docs/operacao/registro.md` (o registro do membro sai antes, por causa do `RESTRICT` de
  `AuditLog.actorId`). O `collections/dev-session.ts` (só banco local) apaga grupos de dev sem rodada na mesma ordem.
- `GET`/`POST /api/groups/:groupId/invite` (admin): vê o código / gera um novo. O antigo deixa de valer na hora.
- `GET /api/invites/:code` (**público**): `{ groupName, memberCount }`. Código inexistente ou trocado → 404.
  Caminho com caractere de controle (ex.: `%00`) → 404 em qualquer rota, antes de guard e banco
  (`rejectControlCharsInPath` no `setupApp`). `\0` em qualquer texto do corpo já validado → 400 (`ZodValidationPipe`; campo desconhecido é descartado
  antes).
- `POST /api/invites/:code/join` `{ nickname, primaryPosition, avatar? }`: entra como `PLAYER`, nota 6 → 201 (sem
  `avatar`, o `DEFAULT_AVATAR`: clientes antigos seguem valendo). Já é membro ativo → 200 com o grupo, sem duplicar nem
  mudar os dados. Inativo → 409 `{ code: 'MEMBERSHIP_INACTIVE', message }`. Apelido de outro ativo → 409
  `{ code: 'NICKNAME_TAKEN', message }`, nada criado; a checagem e a gravação ficam na mesma transação, com a linha do
  grupo travada (dois `join` ao mesmo tempo com o mesmo apelido: um 201 e um 409).
- `GET /api/me`: cada grupo traz também o `nickname` e o `avatar` de quem vê (faixa VOCÊ, card de resultado, Perfil).
  As listas de presença, os times e o jogo (`rounds`, `lineup`, `match`) trazem o `avatar` de cada jogador.

**No app** (`apps/web`, telas `entrar-e-grupo`): `/entrar`, `/comecar`, `/convite/:code` e `/perfil` (aba Perfil, versão mínima).
- Quem está logado e sem grupo é mandado para `/comecar` (criar a pelada ou colar link/código de convite).
- Convite deslogado: o destino `/convite/:code` fica em `sessionStorage` antes do Google e é retomado na volta.
- Depois de criar/entrar: sessão invalidada, `setCurrentGroupId` e vai para `/`.
- Perfil: nome e foto do Google, peladas do usuário (troca do grupo atual), e, só para admin, link de convite
  (Copiar, WhatsApp, "Gerar novo link" com confirmação). Sair chama o logout.

**Não faz:** foto do jogador (o bonequinho é o rosto; `photoUrl` segue no banco e nos contratos, sem uso); aprovar
entrada (grupo de confiança: tem o link, entra); sair do grupo por conta própria; apagar participação.
**Evite:** tratar a nota 6 como média medida; reativar membro pelo convite; deixar o admin mexer no próprio papel ou
se desativar (`SELF_CHANGE`); contar inativo como apelido em uso; mostrar membros na prévia pública;
reaproveitar o código antigo depois de gerar um novo; slug como identificador nas rotas (rotas usam `groupId`).

### Bonequinho: `PlayerAvatar` 🚧
**O que é:** o rosto pixel do jogador (`packages/domain/src/group/avatar.ts`): três escolhas, cada uma de uma lista
fechada. Dono, 14 nov 2026: "ao escolher o apelido, o jogador monta o bonequinho, com cor da pele e cabelo; é o rosto
em todo lugar".
- Pele (`AVATAR_SKINS`): `LIGHT`, `FAIR`, `TAN`, `BROWN`, `DARK` (do mais claro ao mais escuro).
- Cabelo (`AVATAR_HAIRS`): `BALD` (careca), `SHORT`, `CURLY`, `AFRO` (black power), `LONG`, `MOHAWK`. Careca ignora a cor.
- Cor do cabelo (`AVATAR_HAIR_COLORS`): `BLACK`, `BROWN`, `BLOND`, `RED`, `GRAY`.
- `PlayerAvatar = { skin, hair, hairColor }`; `DEFAULT_AVATAR` = `{ TAN, SHORT, BLACK }` (quem nunca montou o seu, inclusive
  quem já existia antes); `isPlayerAvatar(valor: unknown)`: `boolean`, estreita o tipo, recusa valor fora da lista,
  campo faltando ou valor que não é objeto (campo extra é ignorado).

**Faz:** vive na **participação** (`Membership.avatarSkin`/`avatarHair`/`avatarHairColor`, três enums do Prisma iguais
às listas; `domain-enums.spec.ts` garante): é o jogador **naquela pelada**, como o apelido. Todo membro tem bonequinho
(coluna com padrão), então todo contrato devolve `avatar` sempre, sem estado "não montou". Schema `avatarSchema` no
`shared` (`domain.ts`, para auth/round/match importarem sem ciclo); nomes das opções em `AVATAR_SKIN_LABELS`,
`AVATAR_HAIR_LABELS` e `AVATAR_HAIR_COLOR_LABELS`. O jogador troca o seu pelo `PATCH` do perfil; o admin troca o de
qualquer um. Seed: bonequinho fixo por índice do membro (`seedAvatarFor`), sem sorteio.

**Não faz:** não tem foto (`photoUrl` sem uso); não tem opção além das três listas (barba, acessório, uniforme ficam
fora); não guarda o bonequinho no `User`; não desenha nada (o desenho do rosto e do corpo é do front).

**Evite:** tratar `avatar` como opcional na resposta; sortear bonequinho no servidor; cor de cabelo obrigatória para
careca na tela; hex de pele ou cabelo solto na tela (são tokens).

### Feed: avisos e resenhas: `feedAlerts` / `validatePostInput` / `validateCommentText` ✅
**O que é:** a tela inicial do app (`packages/domain/src/feed`): em cima, os **avisos** do que está acontecendo (um
grande por vez, os outros em linha); embaixo, as **resenhas** que os admins escrevem, com reações e comentários de
todo mundo. Decidido pelo dono (22 out 2026: um aviso grande por vez, ordem resultado > votação > presença; 14 nov
2026, P6: resenha só de texto na v1).

**Avisos, `feedAlerts(rounds, now)`:** saem do estado das rodadas, **não ficam gravados**. Cada aviso é
`{ type, roundId }`, no máximo um por tipo, na ordem de prioridade de `FEED_ALERT_TYPES` (o primeiro é o aviso grande):
`IN_PROGRESS` (jogo rolando), `POST_MATCH` (hora da Resenha), `RESULT` (resultado saiu, até 7 dias:
`pickLatestResult`), `VOTING` (`pickVotingRound`), `TEAMS_PUBLISHED`, `PRESENCE` (presença aberta). Os tipos
`IN_PROGRESS`, `POST_MATCH`, `TEAMS_PUBLISHED` e `PRESENCE` olham a rodada da vez (`pickCurrentRound`). O jogo ao
vivo vem antes de tudo; a folha fixa só "resultado > votação > presença". `now` vem de fora. A API devolve cada aviso
com o número e o horário da rodada e o `me` de quem pede (`attendance`, `team`, `played`, `voted`; cada campo só no
tipo em que faz sentido). O `RESULT` traz também `hasPack` (só nele; `true` se a rodada tem Craque com nota: `TeamPlayer.isMvp` com `roundScore` não nulo; `false` na rodada fechada sem votos), para o Feed escolher "Abrir pacote" ou "Ver resultado" sem chamar `GET .../voting/result`. Antes de calcular, a rota fecha as votações vencidas do grupo (`closeDueVotings`), como a lista de rodadas: senão
entregaria `VOTING` de uma votação que o card fecha ao abrir, e o topo do Feed ficaria vazio no lugar do `RESULT`.

Na tela, o `RESULT` cujo pacote já foi aberto **neste aparelho** (`hasOpenedResult`) desce para linha e o próximo
da lista vira o aviso grande. Sem aviso grande (nenhum aviso, ou só resultados já abertos), o Feed mostra "Nenhuma
rodada marcada" (admin com a tecla "Criar rodada") e as linhas ficam abaixo. No máximo uma tecla amarela na tela.

**Resenha:** só **admin** escreve, edita e apaga (qualquer admin, de qualquer resenha). Título opcional até 60
caracteres (`POST_TITLE_MAX_LENGTH`); texto obrigatório até 1000 (`POST_BODY_MAX_LENGTH`), com quebra de linha. Só texto.
`validatePostInput({ title, body }): PostInputError[]` (`TITLE_TOO_LONG`, `BODY_EMPTY`, `BODY_TOO_LONG`,
`INVALID_CHARACTERS`; lista vazia = válida). Conta o caractere visível (grafema), como o apelido, e a quebra de linha
(`\n` ou `\r\n`) vale e conta como um; controle solto (`\r`, tab, `\0`) e invisível não. Entrada já sem espaço nas
pontas e em NFC (o schema do shared faz). Título vazio vira `null`. Apagar a resenha apaga reações e comentários;
o autor que ficou inativo continua aparecendo como autor.

**Reação:** uma por pessoa por resenha, de uma lista fechada de 5 (`POST_REACTIONS`, nesta ordem: `BALL` Bola "golaço, curti o
lance"; `CATFISH` Bagre, a zoeira de "joga mal hoje"; `OSS` OSS!, respeito e raça; `YELLOW_CARD` Cartão amarelo, "essa foi feia"; `POPCORN` Pipocou, "amarelou, fugiu da dividida"; enum `PostReactionType` do Prisma igual, `domain-enums.spec.ts` garante). Tocar em outra troca; tocar na
mesma tira. Banco: chave `(postId, membershipId)`, então dois pedidos juntos dão uma linha só. Exceção autorizada
pelo dono à regra "o amarelo é só da tecla de ação": o ícone do cartão amarelo (`YELLOW_CARD`) é amarelo, porque é
ícone, não tecla.

**Comentário:** qualquer membro, até 280 caracteres (`COMMENT_MAX_LENGTH`), sem edição.
`validateCommentText(text): TextFieldError | null` (mesma regra de caractere da resenha). Apaga o autor ou um admin
(`canDeleteComment`); outro jogador recebe 403 `NOT_OWN_COMMENT`. A lista devolve no máximo os 200 mais recentes, em
ordem de envio. Permissões: `canManagePost(actor)` (admin) e `canDeleteComment(actor, authorId)`.

**Contrato:** `packages/shared/src/feed.ts`; rotas sob `/api/groups/:groupId`: `GET /feed/alerts`, `GET|POST /posts`
(paginado por cursor, 10 por página, da mais nova para a mais antiga), `GET|PATCH|DELETE /posts/:postId`,
`PUT|DELETE /posts/:postId/reaction`, `GET|POST /posts/:postId/comments`, `DELETE /posts/:postId/comments/:commentId`.
Usuário de outro grupo ou membro inativo: 404 em tudo. Seed: 3 resenhas de exemplo (uma sem título, uma longa com
quebra de linha) com reações e comentários.

**Não faz:** imagem ou vídeo; link clicável e menção; responder, editar ou reagir a comentário; resenha gerada sozinha
do resultado; moderação além do admin apagar (grupo de confiança); tempo real em reação e comentário; push.

**Evite:** gravar aviso no banco (tem que sair do estado das rodadas); repetir a ordem de prioridade na tela; deixar o
front decidir quem pode editar ou apagar (`canManage` e `canDelete` vêm da API); contar caractere por `length`.

### Sinal de eventos da rodada e canal ao vivo: `RoundEvent` / `RoundStreamEvent` / `LIVE_ROUND_STATUSES` 🚧
**O que é:** um sinal técnico, sem regra de negócio nova. O `RoundEventsService` (`apps/api/src/events`) avisa, em
memória, que uma escrita da rodada acabou de ser gravada: `{ groupId, roundId, type, scopes, actorMembershipId }`,
com `type` entre `ROUND_CREATED`, `ROUND_UPDATED`, `ROUND_DELETED`, `TEAMS_PUBLISHED`, `TEAMS_UNPUBLISHED`, `MATCH_STARTED`, `SCORE_SET`,
`MATCH_FINISHED`, `VOTING_OPENED`, `EVENT_LAUNCHED`, `EVENT_REMOVED`, `ROTATION_STARTED`, `ROTATION_STOPPED`,
`VOTE_CAST` e `VOTING_CLOSED`, e `scopes` entre `match` (jogo), `voting` (votação) e `status` (etapa).
**Quem ouve:** vários ouvintes no mesmo sinal. Hoje o canal ao vivo (SSE, `GET /api/groups/:groupId/rounds/:roundId/stream`,
contrato em `packages/shared/src/live.ts`), que repassa só `{ scopes, at }` (`RoundStreamEvent`) aos aparelhos
conectados, para eles buscarem a própria visão; o push da `pwa-e-push` ouve o mesmo sinal, e um serviço de notificação
futuro entra do mesmo jeito. Só membro ativo do grupo abre o canal, e só para rodada numa etapa com canal
(`LIVE_ROUND_STATUSES`: de `SCHEDULED` a `VOTING`; encerrada não); resposta comum 404 para o resto. A presença
não sinaliza.
**Faz:** sinaliza depois do commit, uma vez por escrita que mudou algo; `actorMembershipId` é quem pediu, ou `null`
quando ninguém pediu (último voto, prazo vencido, relógio) e no `VOTE_CAST`.
**Não faz:** não carrega dado de domínio, nunca o conteúdo do voto nem quem votou; não sinaliza escrita recusada, o
mesmo placar repetido nem outra rodada; não funciona com mais de uma instância da API (emissor em memória; o caminho
é `LISTEN/NOTIFY`, ver `docs/02-arquitetura.md`).
**Evite:** mandar estado ou dado sensível pelo sinal ou pelo canal; sinalizar de dentro da transação; chamar o canal
ao vivo direto dos services (eles só sinalizam).

### Avisos (push): `notificationRecipients` / `notificationContent` ✅
**O que é:** o app avisa pelo celular, com o app fechado (Web Push), quando acontece algo da pelada. São 4 avisos
(`NOTIFICATION_TYPES`, em `packages/domain/src/notifications`), todos por evento, nenhum agendado (resposta do dono à
P7, 14 nov 2026; lembrete com hora marcada pede um agendador e a API gratuita dorme):

| Tipo | Quando | Quem recebe | Abre |
|---|---|---|---|
| `ROUND_CREATED` | o admin cria a rodada | todos os ativos do grupo | detalhe da rodada |
| `TEAMS_PUBLISHED` | o admin publica os times (despublicar não avisa; publicar de novo avisa de novo) | os escalados (titulares e reservas) que seguem ativos | aba Times |
| `VOTING_OPENED` | o admin abre a votação | quem jogou a rodada e segue ativo | votar |
| `RESULT_OUT` | a votação fecha (admin, último voto ou prazo, uma vez só por fechamento) | todos os ativos do grupo | resultado |

**Quem recebe:** `notificationRecipients(type, { activeMemberIds, lineupIds?, actorId })` devolve membershipIds, sem
repetir, só de membro **ativo**, e **sem o ator** (quem causou a ação não recebe o próprio aviso; `actorId` `null` =
ninguém causou: prazo, último voto). Não envia nada nem conhece aparelho. Sem escalados, os tipos de escalação não
têm destinatário. Quem foi desativado depois de jogar não recebe.

**O texto:** `notificationContent(type, data)` (shared) é a fonte única de título, texto, `url` e `tag`. O título é o
**nome da pelada**; a data é a **real da rodada**, no formato do app e no fuso de Brasília ("sáb, 24 out, 9h"; o
prazo da votação, "até sáb às 21h"), nunca um dia da semana fixo. O `RESULT_OUT` **não diz quem foi o Craque**: o
suspense é do pacote. A `url` leva `?grupo=<groupId>` (o aviso pode ser de outra pelada do usuário; o app só troca
para uma pelada que é dele). A `tag` é `${type}:${roundId}`: o aviso novo substitui o antigo na bandeja.

**Por aparelho:** a assinatura (`PushSubscription`: `endpoint` único, chaves, `userAgent`) é de um aparelho de um
usuário e vale para todas as peladas dele; não há escolha por tipo nem por grupo na v1. Ligar num celular não liga
no outro; outro usuário entrando no mesmo aparelho (mesmo `endpoint`) toma a linha; sair da conta desliga os avisos
daquele aparelho. O navegador só pede permissão depois do toque em "Ativar avisos".

**Cortesia:** aviso nunca falha a ação (publicar, abrir votação...): o envio sai depois de gravar, sem esperar, com
TTL de 12 h; erro de rede vai para o log com o `requestId` e a assinatura fica; 404 ou 410 do serviço de push apaga a
assinatura. Push não grava no `AuditLog`. Sem as três variáveis VAPID (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
`VAPID_SUBJECT`; as três ou nenhuma) o push fica desligado: `GET /push/config` diz `enabled: false` e nada tenta enviar.

**Contrato:** `packages/shared/src/push.ts`; rotas sob `/api`, só com sessão (sem grupo): `GET /push/config`,
`PUT|DELETE /push/subscriptions` (204), `POST /push/test` (`{ sent }`).

**Evite:** pôr destinatário ou texto no service ou no front (vêm do domain e do shared); revelar o Craque no
resultado; um dia da semana fixo no texto; pedir permissão sem toque; deixar o envio atrasar ou derrubar a ação.

---

### Produção: despertador, monitoramento e backup ✅

**O que é:** a operação do ambiente de produção (`main` + Neon `prod`), separada do staging. Não tem regra de negócio:
não mexe em `packages/domain`. Spec: `docs/specs/producao.md`; passo a passo do dono: `docs/deploy.md`.

**Endereço:** domínio próprio `.com.br` (o Google não aceita `*.vercel.app` como domínio autorizado), `futstats-app.com.br` (comprado no registro.br em 18 nov 2026), escrito no
`render.yaml`, no `vercel.json` e nos docs; o `scripts/check-deploy-config.mjs` confere que o host do `vercel.json` é o do
`APP_URL` de produção e que não é `*.vercel.app`. O `fut-stats-app.vercel.app` (endereço padrão do projeto)
continua indo para a API de produção.

**Despertador (`apps/api/src/internal`):** `POST /api/internal/tick`, `Authorization: Bearer <TICK_SECRET>`, sem sessão
(`@Public()` tira o guard de sessão; o guard próprio compara o segredo em tempo constante e qualquer falha é o mesmo 401,
sem dizer o motivo). Só chama `VotingService.closeDueVotings(new Date())` (todos os grupos) e devolve `TickResult`
(`{ closedVotings }`, `packages/shared/src/internal.ts`): o registro (`VOTING_CLOSED` sem autor e sem `requestId`), o sinal
único e o push `RESULT_OUT` saem desse método, uma vez só mesmo com dois `tick` ao mesmo tempo (trava por rodada). O módulo
só existe com `TICK_SECRET` no ambiente (mínimo de 32 caracteres, só na produção): sem ele a rota responde 404
(`InternalModule.forEnvironment()`, o desenho do `DevModule`). Quem chama é o GitHub Actions
(`.github/workflows/despertador.yml`, de 30 em 30 minutos, direto na API de produção no Render): a votação fecha "no prazo,
com até uns 30 a 40 minutos de folga"; o último voto e quem abre o app depois do prazo seguem fechando na hora.

**Relógio interno em produção:** desligado (`VOTING_CLOSER_INTERVAL_MS=0` no serviço de produção do `render.yaml`):
ele consultaria o banco a cada minuto e o Neon gratuito nunca dormiria. O staging segue com o relógio de 1 minuto.

**Sentry da API (`apps/api/src/common/monitoring.ts`):** só com `SENTRY_DSN` (sem ele o pacote nem é carregado). Vai só
erro de verdade: o 500 não tratado e qualquer resposta com status >= 500 (o `AllExceptionsFilter` captura); 400, 401, 403,
404 e 409 não vão. O evento leva as tags `requestId` e `groupId`, `user: { id }` e `environment` (`SENTRY_ENVIRONMENT`,
padrão `NODE_ENV`); nunca email, nome, cookie, cabeçalho, corpo, query nem IP (`dataCollection` fechado e `beforeSend`, que
deixa só o id do usuário). Sem rastreamento de desempenho. Na subida, uma mensagem info "API no ar" prova que o Sentry está
ligado. No web, o Sentry entra por `import()` depois da primeira tela, só com `VITE_SENTRY_DSN`.

**Backup (`scripts/backup-db.sh`, `scripts/restore-db.sh`):** todo dia, `pg_dump` do banco de produção, gzip e gpg
(AES256, senha em `BACKUP_PASSPHRASE`), guardado 30 dias como artefato do GitHub Actions (`.github/workflows/backup.yml`).
Restaurar recusa destino com tabelas sem `--force`. Um backup que nunca foi restaurado não é backup: o dono restaura numa
branch descartável do Neon antes do lançamento.

**Seed e rotas de dev:** o seed recusa `NODE_ENV=production` ("O seed não roda em produção", código 1, antes de tocar no
banco); as rotas `/api/dev/*` não existem em produção.

**Evite:** dar ao despertador outra tarefa que não seja fechar votação vencida (lembretes e rodízio precisam de precisão que
o agendamento do GitHub não tem); aceitar o segredo fora do cabeçalho `Authorization`; mandar 4xx, dado pessoal ou corpo de
pedido para o Sentry; ligar `VOTING_CLOSER_INTERVAL_MS` em produção; usar o `x-request-id` do cliente em produção.

---

## Conceitos ainda não implementados 📋

O que sobra abaixo existe só como tabela no banco (`apps/api/prisma/schema.prisma`, enums iguais aos do domain),
sem regras próprias nem rotas. Rodada, Scout, Voto e Resultado já têm regras e rotas (ver "Rodada, placar e
scouts" e "Votação, fechamento e resultado" acima).

### Grupo e participação (`Group` / `Membership`)
**O que é:** grupo = uma pelada. Membership = um usuário num grupo, com papel (`ADMIN` ou `PLAYER`) e os dados de
jogador daquele grupo: apelido, bonequinho (`PlayerAvatar`), posição principal e secundárias, nota inicial (dada pelo
admin), se é goleiro contratado (`isHiredGoalkeeper`) e se está ativo (`photoUrl` existe e não é usado). **Apelido com até 10 letras** (`validateNickname`). Criar grupo e
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
ou reserva) **jogou**: é a lista de `playedIds` das notas. Para publicar os times e começar o jogo, **confirmou =
escalou**: todo confirmado está num time e todo escalado está confirmado (`ATTENDANCE_MISMATCH`). Por time: 7 titulares e até 2 reservas.
Os times da rodada viram `RoundTeams` no domínio (ver "Rodada, placar e scouts").
Quem marca a presença e até quando: ver "Presença" acima.
**Evite:** usar `Attendance` sozinha como "jogou" (jogou = está no `TeamPlayer`; mas publicar e começar exigem
confirmados = escalados, então na prática quem confirmou joga); o mesmo membro nos dois times.
