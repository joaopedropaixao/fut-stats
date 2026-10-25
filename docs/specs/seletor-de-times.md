# `seletor-de-times`

> Spec de fatia da Trilha. Fluxo da equipe: `docs/specs/2026-10-24-equipe-design.md`.

| | |
|---|---|
| **Fatia** | `seletor-de-times` (#2 da Trilha) |
| **Modo** | Par |
| **Parte de** | `montar-times` (PR #45, já na `develop`): a tela `/rodadas/:roundId/times` e as rotas de `.../lineup` |
| **Status** | aprovado em 2026-10-25 |

## Produto

### Objetivo
Na tela de montar, o admin toca no bloco "?" e recebe Branco x Preto sugeridos pelo `balanceTeams`, com os
confirmados da rodada. Depois ajusta tocando (como já faz), regera quantas vezes quiser, salva e publica. Um card
de equilíbrio mostra, ao vivo, a média de cada time e se a diferença está boa.

### Quem usa
- **Admin:** gera, regera, ajusta, vê o equilíbrio, salva e publica (o salvar e o publicar são os do `montar-times`).
- **Jogador:** nada muda. Não vê o bloco nem o card (a tela de montar é só do admin).
- **Usuário de outro grupo, ou membro inativo:** 404.

### Regras de domínio
- **Gerar é sugestão:** a API calcula e devolve, **sem gravar**. A sugestão entra no rascunho da tela como um passo
  (dá para Desfazer). Fica no banco só quando o admin Salva (decisão do dono, 25 out 2026).
- **Gerar troca tudo:** sempre parte de todos os confirmados ativos e substitui os dois times. Com alguém já no
  rascunho, uma gaveta pede confirmação antes (decisão do dono).
- **Regerar dá outra divisão:** sorteia entre as divisões até uma folga (`tolerance`) do melhor custo e evita
  repetir a sugestão anterior quando houver outra dentro da folga (decisão do dono).
- **O custo passa a ser em média de nota** (era soma normalizada para 7), para os pesos serem legíveis:
  `custo = |média Branco − média Preto| + λ · repetição em excesso + μ · panelinha`. A posição continua vindo antes:
  nenhuma divisão põe mais gente fora da principal que o mínimo possível.
- **Duplas repetidas contam pelo excesso sobre o acaso, com peso maior para a rodada mais recente** (dono). Para cada
  par de jogadores de linha: `max(0, Σ peso · juntos − Σ peso · chance de cair junto)`, nas 4 últimas rodadas, com
  pesos 1 / 0,75 / 0,5 / 0,25 (mais recente primeiro). Chance de cair junto numa rodada em que os dois jogaram =
  `(tamanho do time de linha − 1) / (total de linha − 1)`.
- **Fator panelinha** (dono): dupla que vence junto é penalizada se ficar junta de novo. Por par de linha, nas 10
  últimas rodadas com placar (pesos de 1 a 0,19, caindo 0,09 por rodada): `saldo = Σ peso · ±min(diferença de gols, 4)
  / 4`. É `+` quando venceram no mesmo time, `−` quando perderam juntos, e `0` no empate ou se a rodada não tem placar.
  Entra no custo como `max(0, saldo)`.
- **Placar pegado conta menos** (dono): a panelinha pesa pela diferença de gols (até 4). Vitória de 1 gol pesa ¼ de
  uma goleada.
- **Goleiro não entra em dupla nem panelinha** (como hoje).
- **Pesos** (config com default no domain, calibrados na simulação de 25 out 2026): λ = 0,02, μ = 0,05, τ = 0,10
  (em média de nota). Recalibrar quando houver dados reais.
- **Histórico** = as rodadas do grupo **já jogadas** (`IN_PROGRESS`, `VOTING` ou `CLOSED`) marcadas antes desta, da
  mais antiga para a mais recente, com os times (`TeamPlayer`) e o placar.
- **Nota usada:** `Membership.initialRating` (a única que existe até a Fase 3).
- **Card de equilíbrio** (`teamBalance`): média de cada time = soma das notas ÷ jogadores no time. Titular fora da
  posição principal vale nota × 0,9, **esteja ou não nas secundárias** (decisão do dono). Reserva vale a nota
  cheia. Diferença ≤ 0,5 = "Equilibrado"; acima disso, avisa qual time está mais forte (decisão do dono).
  Recalcula a cada toque, com a mesma função do domain que a API usa.

### Cenários
Cada cenário tem um id (`C1`, `C2`...). Os testes levam o id no nome.

**Domínio**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C1 | os casos de hoje do `balanceTeams` (14 a 18, goleiros, posições, erros) | `balanceTeams` com `tolerance: 0` | mesmo comportamento de antes: válido em `isValidRoundLineup`, mínimo fora da posição, menor diferença de média | unitário |
| C2 | confirmados com várias divisões dentro da folga | `balanceTeams` com seeds diferentes | todas as divisões devolvidas têm custo ≤ melhor + `tolerance`, e há mais de uma | unitário |
| C3 | `avoid` = uma divisão (inclusive com os lados trocados), e existe outra dentro da folga | `balanceTeams` | devolve outra divisão; se só houver ela, devolve ela mesma | unitário |
| C4 | dupla junta na rodada mais recente x dupla junta há 4 rodadas, notas empatadas | `balanceTeams` | separa primeiro a da mais recente; junta há 5 rodadas não pesa | unitário |
| C5 | dupla que ficou junta menos vezes que o acaso | `balanceTeams` | não ganha penalidade nem é atraída (excesso = 0) | unitário |
| C6 | dupla que venceu junto por 4 a 0 nas últimas rodadas, notas empatadas | `balanceTeams` | ficam em times diferentes | unitário |
| C7 | vitória junta e derrota junta da mesma diferença; empate; rodada sem placar; 6 a 0 | saldo da panelinha | cancela; 0; não conta; igual a 4 a 0 | unitário |
| C8 | goleiros sempre no mesmo time no histórico | `balanceTeams` | não pesa (goleiro fora das duplas e da panelinha) | unitário |
| C9 | qualquer erro de entrada | `balanceTeams` | `{ ok: false, error }` com um código de `BALANCE_TEAMS_ERRORS`; não lança | unitário |
| C10 | times com titulares na principal, na secundária, fora das duas, e reservas | `teamBalance` | média por time; fora da principal × 0,9 (secundária ou não); reserva cheia | unitário |
| C11 | diferença 0,5 x 0,6; um time vazio | `teamBalance` | 0,5 equilibrado; 0,6 não, com o time mais forte; time vazio = média `null` e `balanced: null` | unitário |
| C12 | um `SaveLineupInput` e os membros | `draftBalance` (shared) | mesmo resultado do `teamBalance` com o rascunho convertido | unitário |

**API**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C13 | admin, rodada `SCHEDULED`, 16 confirmados ativos com 2 goleiros | `POST .../lineup/suggestion` | 200 com os 16 nos times (7 + 7, 1-2-3-1, reservas 1 x 1); o `GET .../lineup` continua igual (nada gravado) | integração |
| C14 | confirmados + desconfirmados + inativos + membros de outro grupo | `POST .../suggestion` | só os confirmados ativos do grupo entram | integração |
| C15 | `avoid` = a sugestão anterior e há empate de notas | `POST .../suggestion` | outra divisão | integração |
| C16 | histórico com dupla junta e vencendo de goleada nas rodadas jogadas anteriores; rodada `SCHEDULED` antiga e rodada de outro grupo com a dupla junta | `POST .../suggestion` | a dupla é separada; a rodada não jogada e a de outro grupo não contam | integração |
| C17 | 13 confirmados; 1 goleiro; 3 goleiros; 19 confirmados | `POST .../suggestion` | 409 `{ code, message }`: `NOT_ENOUGH_PLAYERS`, `NOT_ENOUGH_GOALKEEPERS`, `TOO_MANY_GOALKEEPERS`, `TOO_MANY_PLAYERS`, com o texto do shared | integração |
| C18 | rodada `TEAMS_PUBLISHED` (ou depois) | `POST .../suggestion` | 409 `LINEUP_NOT_EDITABLE` | integração |
| C19 | corpo com `avoid` fora do schema | `POST .../suggestion` | 400 de validação | integração |
| C20 | jogador comum | `POST .../suggestion` | 403 | integração |
| C21 | rodada de outro grupo, grupo em que não é membro, ou membro inativo | `POST .../suggestion` | 404 | integração |

**Tela** (390px, como admin)

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C22 | admin, rascunho vazio, 16 confirmados | toca no bloco "?" ("GERAR TIMES") | o bloco pula; os dois times se enchem, o banco esvazia, aviso "Times gerados" com Desfazer, card de equilíbrio com as duas médias; o bloco vira "REGERAR" | Playwright |
| C23 | rascunho com alguém escalado | toca em "REGERAR" | gaveta "Gerar times novos?" (os times de agora saem). Gerar troca; Voltar não muda nada | Playwright |
| C24 | times gerados | Regerar e depois Desfazer | vem outra divisão; Desfazer volta exatamente a anterior | Playwright |
| C25 | times gerados | o admin troca dois jogadores tocando | o card recalcula na hora (médias e texto) | Playwright |
| C26 | diferença acima de 0,5; um time vazio | olhar o card | ▲ e "PRETO MAIS FORTE POR 0,8" (texto e ícone, não só cor); com time vazio, "—" e "Monte os dois times para comparar" | Playwright |
| C27 | 13 confirmados (ou 1 goleiro) | toca no bloco | aviso de erro com o texto do shared; o rascunho não muda | Playwright |
| C28 | times gerados | Salvar → Publicar → gaveta → Publicar | publica como no `montar-times` | Playwright |
| C29 | Reduzir movimento ligado | toca no bloco | sem pulo; troca sem animar | Playwright |
| C30 | times publicados; esperando a API | abrir a tela; gerar | publicados: sem bloco; gerando: bloco em carregando e desabilitado. Console sem erros no fluxo real | Playwright |

## Técnico

### Contrato
Schemas em `packages/shared/src/lineup.ts` (junto do resto de times), exportados no `index.ts`. Primeiro commit da
branch `-back`.

| Método | Rota (sob `/api`) | Quem pode | Request | Response | Erros |
|---|---|---|---|---|---|
| `POST` | `/groups/:groupId/rounds/:roundId/lineup/suggestion` | admin | `SuggestLineupInput` | `LineupSuggestion` | 400 validação; 403; 404; 409 `LINEUP_NOT_EDITABLE` / `BalanceTeamsError` |

As rotas `GET`/`PUT .../lineup`, `publish` e `unpublish` não mudam. Todo erro 4xx de regra vem como
`{ code, message }`, com a `message` tirada dos labels do shared. `POST` responde 200 (não cria recurso).

```ts
// packages/shared/src/lineup.ts
import { BALANCE_TEAMS_ERRORS, teamBalance, type BalanceTeamsError, type TeamBalance } from '@fut-stats/domain';

/** Por que não deu para gerar os times (`balanceTeams` no domain). */
export const BALANCE_TEAMS_ERROR_LABELS: Readonly<Record<BalanceTeamsError, string>> = {
  DUPLICATE_PLAYER: 'Tem jogador repetido entre os confirmados',
  NOT_ENOUGH_PLAYERS: 'Para gerar os times, precisa de pelo menos 14 confirmados',
  TOO_MANY_PLAYERS: 'Com mais de 18 confirmados não dá para gerar: ajuste as presenças',
  NOT_ENOUGH_GOALKEEPERS: 'Para gerar os times, precisa de 2 goleiros confirmados',
  TOO_MANY_GOALKEEPERS: 'Tem mais de 2 goleiros confirmados: monte os times na mão',
  POSITIONS_UNFILLABLE: 'Os confirmados não fecham o 1-2-3-1, nem com as posições secundárias',
};

/** Corpo de POST .../lineup/suggestion. `avoid` = a divisão de agora, para o Regerar trazer outra. */
export const suggestLineupSchema = z.object({ avoid: saveLineupSchema.optional() });

/** Resposta: os times sugeridos, no mesmo formato do PUT (titulares com a vaga, reservas na ordem). Não grava. */
export const lineupSuggestionSchema = z.object({ teams: saveLineupSchema });

export type SuggestLineupInput = z.infer<typeof suggestLineupSchema>;
export type LineupSuggestion = z.infer<typeof lineupSuggestionSchema>;

/** O membro que o card de equilíbrio precisa (cabe um `AttendanceMember` ou `LineupPlayer`). */
export type BalanceMember = Pick<AttendanceMember, 'membershipId' | 'primaryPosition' | 'rating'>;

/**
 * Equilíbrio do rascunho da tela: converte para o formato do domain e chama `teamBalance`. É a mesma regra da
 * API; o front só mostra. Membro que não está em `members` é ignorado.
 */
export function draftBalance(draft: SaveLineupInput, members: readonly BalanceMember[]): TeamBalance;
export type { TeamBalance };
```

### Banco (`schema.prisma`)
Sem mudança. O histórico vem de `Round` (`status`, `scheduledAt`, `whiteGoals`, `blackGoals`) e `TeamPlayer`.

### Domínio
Em `packages/domain/src/balance-teams/`:
- `BALANCE_TEAMS_ERRORS` (lista `as const`) e `BalanceTeamsError` derivado dela.
- `PastRound` ganha `score?: MatchScore | null` (sem placar, a rodada não conta na panelinha).
- `BalanceTeamsConfig` (defaults em `DEFAULT_BALANCE_TEAMS_CONFIG`):
  - `repeatedPairWeight` (λ) = `0.02`, agora em média de nota por unidade de repetição em excesso.
  - `recencyWeights` = `[1, 0.75, 0.5, 0.25]` (mais recente primeiro). Substitui `lookbackRounds`: a janela é o
    tamanho da lista.
  - `cliqueWeight` (μ) = `0.05`; `cliqueRecencyWeights` = 10 pesos, `1 − 0.09·k`; `cliqueMarginCap` = `4`.
  - `tolerance` (τ) = `0.1`.
  - `offPositionFactor`, `maxReservesPerTeam` e `random` como hoje.
- `balanceTeams(players, history = [], config = {}, options: { avoid?: RoundLineup } = {})`: `avoid` compara só quem
  está com quem (ignora o lado e as posições).
- `strength` na resposta continua a soma normalizada para 7 (sem mudança para quem já usa); `repeatedPairs`
  continua a contagem crua na janela.
- `teamBalance(teams: RoundTeams, players: readonly Pick<Player, 'id' | 'primaryPosition' | 'rating'>[], config?:
  Partial<TeamBalanceConfig>): TeamBalance`, em `src/balance-teams/team-balance.ts`.
  - `TeamBalanceConfig = { offPositionFactor: 0.9, balancedThreshold: 0.5 }` (`DEFAULT_TEAM_BALANCE_CONFIG`).
  - `TeamBalance = { average: Record<Team, number | null>, difference: number | null, balanced: boolean | null,
    stronger: Team | null }`. Médias arredondadas em 2 casas; `stronger` = `null` quando equilibrado ou sem
    comparação.
- Atualizar o seed (`apps/api/src/seed/seed.ts`) para passar o `score` no histórico.
- **Simulação para recalibrar:** `apps/api/scripts/simular-seletor.ts` (script `simular:seletor` no
  `package.json` da api, com o `tsx` que ela já tem). Roda o `balanceTeams` real em grupos simulados com o elenco
  do seed e imprime a tabela da simulação de 25 out 2026: diferença de média, diferença de gols, jogos ≤ 1 gol,
  duplas repetidas, panelinhas juntas e variedade do Regerar, por config. Base: o script da sessão do TPL.

### Tela
- Na tela de montar (`apps/web/src/features/lineup/lineup-builder.tsx`), na ordem da folha (seção "O campo
  1-2-3-1"): seletor de time, **card de equilíbrio**, card de escalação (`LineupStatus`), **bloco "?"**, campo,
  reservas, banco, ações.
- **Bloco "?"** (`generate-block.tsx`): bloco pixel do tipo do Mario (`ideias-de-inspiracao.md`, momento 2) com
  "GERAR TIMES" (rascunho vazio) ou "REGERAR". Alvo ≥ 44px, canto reto, contorno duro. **Não usa o amarelo de ação**
  (que é do Publicar): tons de superfície/madeira do DS. Ao tocar, dá um pulinho em degraus (`steps()`, ≤ 250 ms);
  com Reduzir movimento, nada anda. Carregando: desabilitado e com estado de carregando. Some quando
  `permissions.edit` é `false`.
- Tocar: com alguém no rascunho, abre a gaveta (`Sheet`) "Gerar times novos?" com "Os times de agora saem do
  rascunho. Dá para desfazer." e Voltar / Gerar. Então `POST .../suggestion` com `avoid: toSaveInput(draft)` (só se
  o rascunho tiver alguém). O resultado entra com `pushDraft` (um passo), o aviso "Times gerados" vem com Desfazer
  e o jogador na mão é solto. Em erro, aviso de erro com a `message` da API.
- Converter `LineupSuggestion.teams` no `Draft` da tela: função nova em `lineup-draft.ts`, com teste (o inverso do
  `toSaveInput`).
- **Card de equilíbrio** (`balance-card.tsx`): igual à folha. "BRANCO 7,4" … "7,3 PRETO" em dígitos pixel com uma
  casa e vírgula; barra Branco/Preto proporcional às médias; embaixo ✓ "Equilibrado. Diferença de 0,1." ou ▲
  "Preto mais forte por 0,8." (ícone de alerta em `--color-warning`). Sem comparação: "—" e "Monte os dois times para
  comparar". Calculado com `draftBalance(toSaveInput(draft), members)` a cada render.
- Hook novo `useSuggestLineup` em `features/lineup/queries.ts` (mutação que não mexe no cache do lineup).

### Decisões
- Sugestão sem gravar, entra no rascunho como um passo — dono; regerar não apaga o que está salvo.
- Gerar troca tudo, com gaveta se houver rascunho — dono.
- Card ao vivo com a função do domain, re-exportada pelo `shared` (`draftBalance`) — dono pediu ao vivo. Assim o
  front não ganha dependência nova nem repete a regra.
- Fora da posição (secundária ou não) × 0,9 no card — dono.
- Limite de "Equilibrado": 0,5 de média — dono.
- Repetição pelo excesso sobre o acaso, com recência; panelinha pelo saldo juntos pesado pelo placar; tolerância no
  Regerar — dono, depois da simulação (25 out 2026). Na simulação, a tolerância levou o Regerar de ~2 para ~5
  divisões distintas em 5 toques, com +0,01 de diferença de média. Panelinha e placar não pioraram nada, mas o
  efeito ficou dentro do ruído: μ baixo (0,05) até ter dados reais.
- **Muda o `CONTEXT.md`:** o `balanceTeams` passa a olhar vitórias (pela panelinha), e a entrada dele muda (custo em
  média, config nova). Entra `teamBalance`.
- O bloco "?" é a geração com cara de jogo — dono.
- Treinar os pesos com dados reais fica para depois: item novo em "Futuro" no roadmap ("Calibrar o seletor com dados
  reais": gravar a sugestão x o publicado e a nota de cada um no dia da rodada). Exige mudar o banco.

## Fora do escopo
- Fixar jogadores e regerar só o resto.
- Arrastar com o dedo.
- Gravar a sugestão ou o histórico de notas (vai para "Calibrar o seletor com dados reais").
- Nota medida pelas votações (Fase 3): até lá, `initialRating`.
- Qualquer mudança no `schema.prisma`.

## Perguntas respondidas pelo dono
- O que acontece ao gerar? → Sugestão na tela, sem gravar; entra no rascunho e dá para desfazer.
- Já tem gente no rascunho? → Troca tudo, com gaveta de confirmação.
- O card recalcula ao mexer? → Sim, ao vivo.
- Fora da principal e das secundárias? → Igual à secundária, × 0,9.
- Limite de equilibrado? → 0,5.
- Visual do gerar? → Bloco "?" pixel.
- Regerar, repetição, panelinha e placar → Excesso sobre o acaso; mais peso na recente; panelinha tem que ter;
  tolerância; placar pegado pesa menos. Pesos calibrados na simulação.
- Treinar um modelo? → Ainda não: guardar o script de simulação e um item futuro para calibrar com dados reais.

## QA
<Preenchido no fim: tabela final do QA, número de voltas e veredito.>
