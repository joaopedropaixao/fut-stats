# `polimento-v1`

| | |
|---|---|
| **Fatia** | `polimento-v1` (#16 da Trilha) |
| **Modo** | Front |
| **Parte de** | — (ajustes dos testes do dono em 15 nov 2026) |
| **Status** | rascunho |
| **Base** | develop @5304341 |
| **Depende de** | — |
| **Toca em** | `apps/web/vite.config.ts`, `apps/web/src/features/session`, `apps/web/src/lib/api.ts`, `apps/web/src/features/pack/impact-phrase.ts`, `apps/web/src/features/group/player-card.tsx`, `apps/web/src/index.css` |

## Produto

### Objetivo
Três ajustes que vieram dos testes do dono: abrir folga no orçamento do JS inicial para o `feed` caber, dar uma
frase de impacto própria ao Craque que só deu 1 assistência e vestir a figurinha do jogador com a moldura
bronze/prata/ouro das cartas do pacote.

### Quem usa
Todo membro do grupo. Nada muda de permissão: é tudo tela e build.

### Regras de domínio
- Faixa pela nota: `cardTier` (< 6 bronze, 6 a 7,9 prata, ≥ 8 ouro), sem regra nova
  ([CONTEXT.md › Faixa da carta](../../CONTEXT.md#faixa-da-carta-cardtier-)). Na figurinha, a entrada é a **média**
  do jogador no ranking geral (`stats.average`).
- A frase de impacto é texto de apresentação (`features/pack/impact-phrase.ts`), não regra de negócio.

### Cenários

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C1 | o build de produção de hoje (148,2 kB de JS inicial) | `pnpm --filter @fut-stats/web build` | JS inicial **≤ 138 kB** (folga ≥ 10 kB, meta ~119 kB), limite do `bundle-budget.json` igual (150) e o zod, o `shared` e o `domain` fora dos arquivos que o `index.html` importa | build (`check-build.mjs`) |
| C2 | app recém-aberto, logado, na tela de início | carrega | a sessão (`/me`) continua validada com o `meResponseSchema`; início, rodadas, ranking, votação e pacote abrem como antes, sem erro no console | Playwright + unitário de `use-session` se mudar de forma |
| C3 | app recém-aberto, sem sessão | carrega | vai para `/entrar` como antes; resposta fora do contrato no `/me` continua dando o erro de contrato (não passa sem validar) | Playwright |
| C4 | Craque com 0 gols e **1 assistência**, de linha | abre a carta | frase **"DEU O PASSE"** (no lugar de "JOGOU DEMAIS"); vencedor: "DEU O PASSE E AINDA LEVOU A VITÓRIA" | unitário (`impactPhrase`) + Playwright (carta e imagem do Compartilhar) |
| C5 | goleiro Craque com 0 gols e 1 assistência | abre a carta | continua "PAREDÃO NO GOL" (a ordem das regras não muda: goleiro vem antes) | unitário |
| C6 | Craque com 0 gols e 0 assistências, de linha | abre a carta | continua "JOGOU DEMAIS" | unitário |
| C7 | jogador ranqueado com média 8,2 / 6,5 / 5,4 | abre `/jogadores/:id` (e o próprio Perfil, que usa a mesma figurinha) | o bloco do apelido ganha o fundo da faixa das cartas (`card-frame` + `data-tier`) e escreve **OURO** / **PRATA** / **BRONZE**; média 6,0 e 8,0 caem na faixa de cima | unitário (componente) + Playwright |
| C8 | jogador com "Poucos jogos" (`rank` = `null`) ou sem média | abre a figurinha | figurinha neutra como hoje, sem faixa nem palavra | unitário (componente) |
| C9 | figurinha com faixa, jogador no pódio (1º, 2º ou 3º) | abre | a medalha do pódio continua na faixa de baixo (Ranking/Média), no fundo neutro, separada da moldura; nada sobrepõe em 320, 375, 390, 430 px e desktop | Playwright (checagem de sobreposição) |
| C10 | card do topo do Ranking (`YouCard`) | abre o Ranking | **sem mudança** (veja Decisões) | Playwright (print igual ao de antes) |

## Técnico

### Contrato
Sem mudança. Nenhuma rota nova; os dados já existem (`stats.average`, `rank`, `goals`, `assists`).

### Banco (`schema.prisma`)
Sem mudança.

### Domínio
Sem mudança. `cardTier` já está no `domain` e é reexportado pelo `shared`.

### Tela
- **C1–C3, orçamento.** O relatório do build (sourcemap por módulo) mostra o JS inicial assim: `index` 81,7 kB
  (react-dom, react-query), `button` 37,4 kB (react-router, react, botões/ícones) e `dist` **30,5 kB**
  (zod + `shared` + `domain`). Esse último entra no inicial porque `features/session/use-session.ts` importa
  `meResponseSchema` como valor; também porque o rolldown juntou `components/ui/pixel-glyphs.ts` (usado pelo
  `pixel-digits` do shell) no mesmo pedaço. Caminho:
  1. `use-session` carrega o schema sob demanda (`import('@fut-stats/shared')` dentro do `queryFn`, ou um
     `api`/helper equivalente), disparado já no começo para baixar junto com o `GET /me`, não depois dele.
  2. Um grupo de `codeSplitting` no `vite.config.ts` (rolldown) para o zod + `shared` + `domain`, para que nenhum
     módulo do shell (como o `pixel-glyphs`) os arraste de novo para o inicial.
  3. Se ainda faltar folga, olhar o resto (react-router, ícones) com o mesmo relatório; dependência nova só com
     justificativa.
  O relatório antes/depois (tabela do `check-build.mjs` + top módulos do inicial) vai no PR.
- **C4–C6, frase.** Nova regra em `impactPhrase`, logo antes de "1 gol": `assists === 1` → "Deu o passe". A ordem
  fica: 3+ gols, gol e assistência, 2 gols, 2+ assistências, goleiro, **1 assistência**, 1 gol, senão "Jogou
  demais". Conferir que a frase longa com vitória cabe na carta e no canvas do Compartilhar (`share-card.ts`).
- **C7–C9, moldura.** Em `features/group/player-card.tsx`: o bloco do apelido e da posição (o `p-4` abaixo do
  gramado) recebe `card-frame` com `data-tier={cardTier(average)}` quando `ranking.rank !== null` e
  `ranking.average !== null`, com a palavra da faixa (`TIER_LABELS` de `features/pack/tier.ts`) escrita em pixel na
  cor `--card-ink-2`, como na carta. Apelido e posição passam a usar `--card-ink`/`--card-ink-2` nesse bloco. O
  gramado (com o bonequinho, "VOCÊ" e "ADMIN") e a faixa de Ranking/Média com a medalha ficam como estão.
  `cardTier` vem do `@fut-stats/shared` (essa tela já carrega o `shared`, então não pesa no inicial).
- Álbum em `docs/design/prints/polimento-v1/`: antes/depois de cada item (início, ranking, `/jogadores/:id` nas
  três faixas e em "Poucos jogos", Perfil, carta do Craque com 1 assistência e a imagem do Compartilhar), 390 px
  por cenário, mais 320 px e desktop por tela.

### Decisões
- **"DEU O PASSE"** em vez de "ASSISTÊNCIA DE OURO" — mais curta (cabe com "e ainda levou a vitória" em 320 px e
  no canvas) e não usa "ouro", que agora é palavra da faixa da carta; com a mesma carta podendo ser PRATA, "de
  ouro" confundiria.
- **Goleiro com 1 assistência continua "PAREDÃO NO GOL"** — a regra nova entra depois da do goleiro, como a de
  1 gol já fazia; não reordena o que o dono já viu.
- **Faixa só para quem está no ranking** (`rank !== null`) — com "Poucos jogos" a média é de 1 ou 2 notas; um
  "OURO" de uma rodada só passaria a ideia de selo oficial. Fica neutra como hoje.
- **Faixa no bloco do apelido, não na figurinha inteira** — o gramado verde é a identidade da figurinha, e a
  medalha do pódio (ouro/prata/bronze) mora na faixa de baixo; assim a faixa da nota (moldura) e o pódio (medalha)
  ficam em fundos diferentes e não se confundem (ex.: 3º lugar com média de ouro).
- **Card do topo do Ranking sem faixa** — ele acabou de ganhar o pódio (medalha) e o holofote, e o palco é escuro
  de propósito para o holofote aparecer; um fundo dourado ali brigaria com os dois e com o 3º lugar com moldura de
  ouro. A faixa fica na figurinha, que é a "carta" do jogador; o card do topo leva até ela.
- **Amarelo da tecla × ouro** — a figurinha não tem tecla amarela (o "Ranking" de voltar é outline), e no Perfil os
  botões ficam fora do card. Nenhum card com os dois.
- **Moldura reaproveita `.card-frame[data-tier]`** do `index.css` — mesmo visual das cartas, sem CSS novo de cor.

## Fora do escopo
- Mudar o limite do orçamento (`bundle-budget.json`) ou o CI.
- Faixa nas linhas da lista do Ranking e no card do topo.
- Novas frases além de "1 assistência".

## Perguntas respondidas pelo dono
- Escopo dos três itens → decidido no kickoff (15 nov 2026), a partir dos testes do dono.

## QA
<Preenchido no fim.>
