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
- **Domínio não conhece banco nem usuário.** Recebe ids (`string`) e números; não recebe entidade do Prisma.
- **Goleiro contratado é membro pleno:** joga, vota (notas, MVP, Bola Murcha) e participa do Cartola.
- **Grupo de confiança:** só entra quem é convidado. Sem antifraude pesado; a média aparada basta.
- **Votar e jogar o Cartola são opcionais.** A rodada só exige os 2 goleiros e os confirmados. Regra de notas e
  Cartola tem que funcionar com adesão parcial (poucos votos, poucos times no Cartola) sem quebrar nem travar.
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

### Formação: `FORMATION` / `PLAYERS_PER_TEAM` ✅
**O que é:** quantos jogadores por posição num time: 1 goleiro, 2 zagueiros, 2 alas, 1 meio, 1 atacante.
`PLAYERS_PER_TEAM` = 7 (calculado da formação).
**Não faz:** não há formação alternativa (4-3-3 etc.). A pelada e o Cartola usam sempre 1-2-3-1.
**Evite:** escrever `7` ou `2 zagueiros` direto no código; use as constantes.

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
  - `maxReservesPerTeam` = `2`.
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

### Nota da rodada, MVP e Bola Murcha: `roundScore` ✅
**O que é:** nota final de um jogador na rodada = **média aparada** das notas recebidas (descarta a maior e a menor).
Também define quem pode votar em quem e apura MVP e Bola Murcha pelos votos. Pasta `src/round-score/`.
**Regras:** só quem jogou vota (goleiros inclusos), em qualquer jogador que jogou (dos dois times); ninguém vota
em si mesmo; votos anônimos para jogadores, média pública.

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
  com `AwardBallot = { voterId, mvpId, flopId }` (`flop` = Bola Murcha) e
  `BallotIssue = { voterId, field: 'voterId' | 'mvpId' | 'flopId', code: BallotError }`.
  `BallotError` (lista em `BALLOT_ERRORS`) = os de `VoteError` + `'SAME_PLAYER_BOTH'` + `'DUPLICATE_VOTER'`.
- `isValidAwardBallot(ballot, playedIds): boolean` (versão sim/não).
- `parseBallots(ballots: readonly AwardBallot[], playedIds: readonly string[]): Result<ValidBallots, BallotIssue>`
- `tallyAwards(ballots: ValidBallots, options: AwardOptions): AwardResult`, com
  `AwardOptions = { tieBreak?: 'ROUND_SCORE' (padrão); roundScores: Record<playerId, number | null> } | { tieBreak: 'SHARE' | 'NONE' }`.
  `options` é obrigatório: o desempate padrão sem `roundScores` não compila.

**Faz:**
- `roundScore`: com 4 notas ou mais, descarta as `trim` maiores e menores e tira a média do resto; com 3 ou menos
  faz a média simples (aparar deixaria uma pessoa decidindo a nota). Arredonda (meio para cima: 7,25 → 7,3).
- `validateVote`/`canVoteFor`/`rateablePlayers`: aplicam a regra de voto; `rateablePlayers` lista quem o votante deve avaliar.
- `validateAwardBallot`: voto obrigatório em MVP **e** Bola Murcha, em jogadores diferentes, ambos votáveis. Lista
  todos os problemas do voto; se o votante não jogou, devolve só esse.
- `parseBallots`: valida todos os votos e marca o segundo voto da mesma pessoa como `DUPLICATE_VOTER`.
- `tallyAwards`: mais votado leva. Empate: `ROUND_SCORE` (padrão) dá o MVP à maior nota da rodada e a Bola Murcha
  à menor; quem não tem nota perde o desempate; se a nota empatar (ou ninguém tiver nota), todos levam.
  `SHARE` = todos os empatados levam; `NONE` = ninguém leva.

**Não faz:** não lança erro; não controla prazo nem abertura/fechamento da votação; não guarda votos (recebe ids);
não exige que todos votem; não tem texto de UI (mensagens em `RATING_ERROR_LABELS`/`BALLOT_ERROR_LABELS` no shared).

**Devolve:** `roundScore` → nota arredondada, ou `null` sem notas (`null` ≠ nota 0). `parse*` → `Result` com todos
os problemas. `validate*` → código(s) de erro com o campo, para a borda montar a mensagem. `tallyAwards` →
`{ mvpIds, flopIds }`, listas em ordem alfabética (várias pessoas no empate compartilhado; vazias sem votos ou com `NONE`).

**Evite:** média simples com 4 notas ou mais (deixa passar "voto de sacanagem"); tratar `null` como 0 no ranking; apurar prêmios antes
de calcular as notas da rodada; ignorar voto inválido em silêncio; converter para `ValidRatings`/`ValidBallots` com
`as` fora do `parse*` (fura o carimbo); passar `playedIds` com quem só confirmou presença e não jogou.

### Cartola: `cartolaPoints` / `priceVariation` 🚧 (PR #6)
**O que é:** pontuação de um jogador no Cartola da pelada (nota da rodada + scouts + bônus, capitão × 1,5)
e a variação de preço depois da rodada. Escalação do Cartola também é 1-2-3-1.
**Regras:** escalado que não jogou = 0 pontos; cartoletas são fictícias.
**Evite:** pesos fixos no código (`k`, fator, limites vêm de config do grupo). *Detalhes: completar no PR.*

---

## Conceitos ainda não implementados 📋

### Grupo e participação (`Group` / `Membership`)
**O que é:** grupo = uma pelada. Membership = um usuário num grupo, com papel (admin ou jogador) e tipo
(mensalista ou goleiro). Um usuário pode estar em vários grupos, com papéis diferentes.
**Evite:** qualquer dado de domínio sem `groupId`; checar papel pelo usuário em vez da membership daquele grupo.

### Rodada (`Round`)
**O que é:** um encontro semanal = **uma partida** (Branco x Preto). Notas, MVP e Bola Murcha são por rodada.
**Ciclo:** agendada → times publicados → em jogo → votação → encerrada.
**Evite:** modelar várias partidas por rodada; pular etapas do ciclo.

### Scout (`MatchEvent`)
**O que é:** um lance registrado na rodada (gol, assistência, gol sofrido, defesa...). Guarda **quem lançou**.
**Regras:** o jogador lança os próprios gols/assistências; o admin lança e corrige os de qualquer um.
**Evite:** scout sem autor; jogador lançando scout de outro jogador.
