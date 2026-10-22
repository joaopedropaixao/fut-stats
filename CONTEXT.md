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
- **Validação do domínio responde, não lança.** Funções `is*`/`matches*` devolvem `boolean`; quem decide o erro
  (400, mensagem na tela) é a borda (controller/formulário).
- **Domínio não conhece banco nem usuário.** Recebe ids (`string`) e números; não recebe entidade do Prisma.

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

### Nota: `isValidRating` ✅
**O que é:** nota de 0 a 10, de 0,5 em 0,5 (`RATING_MIN`, `RATING_MAX`, `RATING_STEP`).
**Devolve:** `boolean`. **Não arredonda nem corrige**: `7.3` é inválida, não vira `7.5`.
**Evite:** escala 0–100, nota inteira, nota como string; arredondar em silêncio para "aceitar".

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

### Seletor de times: `balanceTeams` 🚧 (PR #7)
**O que é:** gera Branco x Preto equilibrados a partir dos confirmados da rodada.
**Faz:** um goleiro por time, formação 1-2-3-1, usa posições secundárias se faltar gente, minimiza
diferença de força + penalidade por duplas repetidas nas últimas rodadas.
**Devolve:** `RoundLineup`. É sugestão: o admin pode editar antes de publicar.
**Evite:** aleatoriedade sem seed (os testes precisam ser determinísticos). *Detalhes: completar no PR.*

### Nota da rodada, MVP e Bola Murcha: `roundScore` 🚧 (PR #5)
**O que é:** nota final de um jogador na rodada = **média aparada** das notas recebidas (descarta a maior e a menor).
Também apura MVP e Bola Murcha pelos votos.
**Regras:** só quem jogou vota; ninguém vota em si mesmo; votos anônimos para jogadores, média pública.
**Evite:** média simples (deixa passar "voto de sacanagem"). *Detalhes: completar no PR.*

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
