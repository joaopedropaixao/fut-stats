# `montar-times`

> Spec de fatia da Trilha. Fluxo da equipe: `docs/specs/2026-10-24-equipe-design.md`.

| | |
|---|---|
| **Fatia** | `montar-times` (#1 da Trilha) |
| **Modo** | Par |
| **Parte de** | PR #33 (fechar), branch `origin/feature/tela-montar-times` |
| **Status** | rascunho |

## Produto

### Objetivo
O admin monta Branco x Preto com os confirmados da rodada: toca no jogador e depois na vaga (campo 1-2-3-1 ou
reserva), troca entre os times, salva o rascunho e publica. Com os times publicados, todo mundo vê os times na aba
Times. Se for preciso refazer, o admin despublica.

### Quem usa
- **Admin:** monta, salva, publica e despublica. Vê o rascunho e o que falta para publicar.
- **Jogador:** antes da publicação, vê "Times ainda não saíram". Depois, vê os dois times e o dele em destaque.
- **Usuário de outro grupo, ou membro inativo:** 404 em tudo.

### Regras de domínio
- 1-2-3-1 com 7 titulares e até 2 reservas por time, sem repetir ninguém
  ([CONTEXT.md › Formação](../../CONTEXT.md#formação-formation--players_per_team--max_reserves_per_team-)).
- **Reserva tem posição:** grava a posição principal do jogador (decisão do dono).
- **Quem confirmou presença jogou** (decisão do dono, 24 out 2026): publicar os times e começar o jogo exigem
  **confirmados = escalados**. Todo confirmado está num time (titular ou reserva), e todo escalado está confirmado.
  Com 16 confirmados ficam 14 titulares + 2 reservas. Abaixo de 14 ou acima de 18, não publica: o admin ajusta as
  presenças. **Muda o `CONTEXT.md`**, que hoje diz "confirmou ≠ jogou".
- **Presença mudou depois de publicar:** o admin ainda pode mudar presenças com os times publicados (regra de
  presença atual). A escalação não muda sozinha. Os times passam a não bater, o admin vê o aviso e o jogo não começa
  (`IN_PROGRESS` exige a mesma checagem) até ele despublicar e acertar (decisão do dono).
- Rascunho pode estar incompleto. Só não pode repetir jogador, encher demais uma posição nem passar de 2 reservas
  (`validateLineupDraft`).
- Só dá para mexer no rascunho com a rodada `SCHEDULED`. Publicar: `SCHEDULED → TEAMS_PUBLISHED`. Despublicar:
  `TEAMS_PUBLISHED → SCHEDULED`, mantendo o rascunho
  ([CONTEXT.md › Rodada](../../CONTEXT.md#rodada-placar-e-scouts-validateroundtransition--validatematchevent--shouldclosevoting-)).

### Cenários
Cada cenário tem um id (`C1`, `C2`...). Os testes levam o id no nome.

**Domínio**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C1 | rascunho com o mesmo jogador em dois lugares (dois times, ou titular e reserva) | `validateLineupDraft` | `['DUPLICATE_PLAYER']` | unitário |
| C2 | rascunho com 3 zagueiros num time | `validateLineupDraft` | `['POSITION_FULL']` | unitário |
| C3 | rascunho com 3 reservas num time (ou acima de `maxReservesPerTeam`) | `validateLineupDraft` | `['TOO_MANY_RESERVES']` | unitário |
| C4 | rascunho vazio ou incompleto sem conflito | `validateLineupDraft` | `[]` | unitário |
| C5 | times válidos, mas um confirmado está fora deles | `validateRoundTransition(→ TEAMS_PUBLISHED)` | inclui `'ATTENDANCE_MISMATCH'` | unitário |
| C6 | times válidos, mas um escalado não está confirmado | `validateRoundTransition(→ TEAMS_PUBLISHED)` e `(→ IN_PROGRESS)` | inclui `'ATTENDANCE_MISMATCH'` | unitário |
| C7 | times válidos e confirmados = escalados | `validateRoundTransition(→ TEAMS_PUBLISHED)` | `[]` | unitário |
| C8 | rodada em `VOTING`/`CLOSED` com confirmados diferentes dos escalados | `validateRoundTransition(→ CLOSED)` | não acusa `ATTENDANCE_MISMATCH` (a checagem é só para publicar e começar) | unitário |

**API**

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C9 | admin, rodada `SCHEDULED` sem rascunho, 16 confirmados | `GET .../lineup` | times vazios, os 16 em `unassigned`, `errors` com o que falta, `permissions.edit = true` | integração |
| C10 | `unassigned` | `GET` | só quem confirmou e segue ativo (sem desconfirmados, sem inativos, sem os já escalados) | integração |
| C11 | jogador, rodada `SCHEDULED` com rascunho | `GET` | `published: false`, times e `unassigned` vazios, `errors: []`, permissões todas `false` | integração |
| C12 | admin | `PUT` rascunho incompleto e depois outro | 200, o segundo substitui o primeiro; titulares com a posição da vaga, reservas com a principal e na ordem enviada | integração |
| C13 | admin | `PUT` com o que o domínio recusa (C1–C3) | 400 `{ code, message }` com o código do domínio e o texto do shared; nada muda no banco | integração |
| C14 | admin | `PUT` com quem não confirmou, é de outro grupo ou está inativo | 400 `PLAYER_NOT_CONFIRMED`; nada muda | integração |
| C15 | jogador já no rascunho salvo que desconfirmou depois | admin faz `PUT` mantendo-o | 200 (não trava o salvar); o `GET` traz ele com `confirmed: false` e `errors` inclui `ATTENDANCE_MISMATCH` | integração |
| C16 | rodada `TEAMS_PUBLISHED` (ou depois) | admin faz `PUT` | 409 `LINEUP_NOT_EDITABLE` | integração |
| C17 | rascunho completo com os 16 confirmados (14 + 2) | admin `POST .../publish` | 200, status `TEAMS_PUBLISHED`, `published: true`; o jogador passa a ver os times | integração |
| C18 | rascunho incompleto, ou confirmado fora dos times | `POST .../publish` | 409 com o código do domínio (`INVALID_LINEUP`, `INVALID_RESERVES` ou `ATTENDANCE_MISMATCH`); status não muda | integração |
| C19 | rodada já publicada | `POST .../publish` | 409 `INVALID_TRANSITION` | integração |
| C20 | rodada `TEAMS_PUBLISHED` | admin `POST .../unpublish` | 200, volta a `SCHEDULED` com o rascunho intacto; o jogador deixa de ver | integração |
| C21 | rodada `SCHEDULED` | `POST .../unpublish` | 409 `INVALID_TRANSITION` | integração |
| C22 | times publicados; o admin desconfirma um escalado (ou confirma alguém novo) | `GET` como admin | `errors` inclui `ATTENDANCE_MISMATCH`, o desconfirmado vem com `confirmed: false`, o novo aparece em `unassigned`; a escalação não mudou | integração |
| C23 | jogador comum | `PUT`, `publish`, `unpublish` | 403 | integração |
| C24 | rodada de outro grupo, grupo em que não é membro, ou membro inativo | qualquer rota | 404 e nada muda no outro grupo | integração |

**Tela** (390px, como admin e como jogador)

| Id | Dado | Quando | Então | Teste |
|---|---|---|---|---|
| C25 | admin na rodada `SCHEDULED` (`/rodadas/:roundId`) | toca em "Montar times" | abre `/rodadas/:roundId/times` com o campo vazio do Branco e o banco agrupado por posição | Playwright |
| C26 | jogador no banco | toca nele e depois numa vaga do campo | ele entra na vaga, sai do banco, contagem "BRANCO n DE 7" sobe e aparece o aviso com Desfazer | Playwright |
| C27 | jogador escalado no Branco | toca nele, troca para Preto no seletor e toca numa vaga | ele passa para o Preto | Playwright |
| C28 | vaga ou reserva ocupada | toca num jogador e depois na ocupada | os dois trocam de lugar (o dono vai para onde o outro estava) | Playwright |
| C29 | jogador na mão | toca em "Pro banco" | volta para o banco | Playwright |
| C30 | vários movimentos | Desfazer | volta um passo de cada vez | Playwright |
| C31 | rascunho alterado | Salvar e recarregar a página | o rascunho volta igual | Playwright |
| C32 | 16 confirmados todos escalados | Publicar → gaveta → Publicar | times publicados, card "TIMES PUBLICADOS" com "Despublicar para refazer" | Playwright |
| C33 | algum confirmado fora dos times, ou time incompleto | olhar o card de escalação | o motivo aparece (texto do shared) e o Publicar fica desabilitado | Playwright |
| C34 | times publicados e presença mudou depois | admin abre a tela | aviso de que os times não batem com os confirmados, quem está a mais ou a menos marcado, e o caminho é despublicar | Playwright |
| C35 | admin com times publicados | Despublicar → gaveta de perigo → confirmar | volta ao modo de montar com o rascunho | Playwright |
| C36 | jogador, times publicados | abre a aba Times | vê o campo do time dele primeiro, com "VOCÊ ESTÁ NO PRETO" (ou Branco), e pode ver o outro no seletor | Playwright |
| C37 | jogador, times não publicados | abre a aba Times | "Times ainda não saíram", sem botão de montar | Playwright |
| C38 | admin, times não publicados | abre a aba Times | o mesmo vazio, com a tecla "Montar times" | Playwright |
| C39 | jogador comum | abre `/rodadas/:roundId/times` | vai para `/times` | Playwright |
| C40 | carregando, erro da API, rodada não encontrada | abrir as telas | esqueleto; erro com "Tentar de novo"; vazio de rodada não encontrada. Console sem erros no fluxo real | Playwright |

## Técnico

### Contrato
Schemas em `packages/shared/src/lineup.ts` (parte do PR #33, ajustada), exportados no `index.ts`. Primeiro commit
da branch `-back`.

| Método | Rota (sob `/api`) | Quem pode | Request | Response | Erros |
|---|---|---|---|---|---|
| `GET` | `/groups/:groupId/rounds/:roundId/lineup` | membro | — | `Lineup` | 404 |
| `PUT` | `/groups/:groupId/rounds/:roundId/lineup` | admin | `SaveLineupInput` | `Lineup` | 400 `LineupDraftError` / `PLAYER_NOT_CONFIRMED` / validação; 403; 404; 409 `LINEUP_NOT_EDITABLE` |
| `POST` | `/groups/:groupId/rounds/:roundId/lineup/publish` | admin | — | `Lineup` | 403; 404; 409 `RoundTransitionError` |
| `POST` | `/groups/:groupId/rounds/:roundId/lineup/unpublish` | admin | — | `Lineup` | 403; 404; 409 `INVALID_TRANSITION` |

Todo erro 4xx de regra vem como `{ code, message }`, com a `message` tirada dos labels do shared.

```ts
// packages/shared/src/lineup.ts
export const LINEUP_DRAFT_ERROR_LABELS: Record<LineupDraftError, string>; // DUPLICATE_PLAYER, POSITION_FULL, TOO_MANY_RESERVES
export const LINEUP_NOT_EDITABLE_LABEL = 'Só dá para mexer nos times com a rodada agendada: despublique antes';
export const PLAYER_NOT_CONFIRMED_LABEL = 'Só entra no time quem confirmou presença';
// + ROUND_TRANSITION_ERROR_LABELS ganha ATTENDANCE_MISMATCH:
//   'Os times não batem com os confirmados: todo confirmado precisa estar num time'

lineupSlotInputSchema = z.object({ membershipId: z.string().min(1), position: positionSchema });
teamDraftInputSchema  = z.object({ starters: z.array(lineupSlotInputSchema), reserves: z.array(z.string().min(1)) });
saveLineupSchema      = z.object({ WHITE: teamDraftInputSchema, BLACK: teamDraftInputSchema });

// Escalado: o membro + a posição em que joga (reserva = principal) + se ainda está confirmado.
lineupPlayerSchema = attendanceMemberSchema.extend({ position: positionSchema, confirmed: z.boolean() });
lineupTeamSchema   = z.object({ starters: z.array(lineupPlayerSchema), reserves: z.array(lineupPlayerSchema) });

lineupPermissionsSchema = z.object({ edit: z.boolean(), publish: z.boolean(), unpublish: z.boolean() });

lineupSchema = z.object({
  status: roundStatusSchema,
  published: z.boolean(),                 // status ≠ SCHEDULED
  teams: z.object({ WHITE: lineupTeamSchema, BLACK: lineupTeamSchema }),
  unassigned: z.array(attendanceMemberSchema), // confirmados ativos sem time
  errors: z.array(z.enum(ROUND_TRANSITION_ERRORS)), // o que impede publicar/começar; só admin, [] para jogador
  permissions: lineupPermissionsSchema,   // calculadas com o domínio (papel + status); jogador: tudo false
});
// tipos: SaveLineupInput, LineupPlayer, LineupTeam, LineupPermissions, Lineup
```

- `errors` (admin): em `SCHEDULED`, `validateRoundTransition(→ TEAMS_PUBLISHED)`; em `TEAMS_PUBLISHED`, a de
  `→ IN_PROGRESS` (é o que acusa a presença mudada depois de publicar). Nos outros status, `[]`.
- `permissions.edit` = admin e `SCHEDULED`; `publish` = admin e `SCHEDULED` (mesmo com `errors`, para a tela
  mostrar o motivo; o Publicar fica desabilitado quando `errors` não está vazio); `unpublish` = admin e
  `canTransitionRound(→ SCHEDULED)`.
- Jogador antes da publicação: `teams` vazios, `unassigned: []`, `errors: []`.

### Banco (`schema.prisma`)
Sem mudança. Usa `TeamPlayer` (`team`, `position`, `isReserve`). A ordem dos reservas é a do `createdAt` (o `PUT`
grava na ordem enviada, dentro de uma transação que apaga e recria o rascunho).

### Domínio
- `validateLineupDraft(draft: RoundTeams, options?: RoundTeamsOptions): LineupDraftError[]` e
  `LINEUP_DRAFT_ERRORS` (`src/round/lineup-draft.ts`, do PR #33).
- `RoundState` ganha `confirmedIds: readonly string[]` (obrigatório). Atualizar quem monta `RoundState` (testes,
  fixtures, seed).
- `ROUND_TRANSITION_ERRORS` ganha `'ATTENDANCE_MISMATCH'`. `validateRoundTransition` acusa quando o destino é
  `TEAMS_PUBLISHED` ou `IN_PROGRESS` e o conjunto `roundPlayerIds(teams)` ≠ `confirmedIds`.
- Apoio exportado: `validateAttendanceMatch(teams: RoundTeams | null, confirmedIds): RoundTransitionError[]`.

### Tela
- **Montar** `/rodadas/:roundId/times` (só admin; jogador vai para `/times`). Entrada: tecla "Montar times" no
  detalhe da rodada (admin, `SCHEDULED`) e na aba Times vazia.
- **Aba Times** `/times`: a rodada atual (`currentId` da lista de rodadas, como o início), times publicados no mesmo
  campo, só para ver; o time de quem está vendo (`membershipId` do `/me`) abre primeiro, com o selo "VOCÊ ESTÁ NO
  BRANCO/PRETO".
- Peças do PR #33 (`apps/web/src/features/lineup/`): seletor Branco/Preto, card de escalação 7 + 7, campo 1-2-3-1
  com vaga da vez, reservas, banco agrupado por posição, barra flutuante, aviso com Desfazer, gaveta de confirmação.
  Refazer no padrão das telas de entrar e de rodadas (Chakra Petch no lugar da Inter, `member-avatar`,
  `route-button`, queries do `features/rounds`). Escalado com `confirmed: false` aparece marcado ("SEM PRESENÇA",
  não só cor).
- Movimento: **tocar e tocar** (sem arrastar). Sem dependência nova.

### Decisões
- Tocar e tocar, sem arrastar — escolha do dono; é o que a folha desenha e funciona no leitor de tela.
- Confirmados = escalados para publicar e começar — "quem confirmou presença jogou" (dono).
- Presença mudada depois de publicar não mexe nos times; trava o início até o admin corrigir (dono).
- O `PUT` aceita quem já está no rascunho salvo mesmo que tenha desconfirmado (não trava salvar outras trocas); o
  publicar barra.
- `permissions` vêm da API, como no detalhe da rodada: o front não repete a regra de status.
- Sem o card "Equilíbrio" (notas) e sem "Sugerir times": ficam para `seletor-de-times` (#5).
- O roadmap "Admin: montar Branco x Preto manualmente e lançar o placar" só fecha com `placar-e-lances` (#2).

## Fora do escopo
- Gerar times (`balanceTeams`), card de equilíbrio, regerar (#5).
- Começar o jogo, placar e lances (#2). Aqui só o domínio passa a exigir confirmados = escalados para `IN_PROGRESS`.
- Arrastar com o dedo.
- Dois admins editando ao mesmo tempo (o último `PUT` vence).

## Perguntas respondidas pelo dono
- "Quem confirmou presença jogou" muda o publicar? → Sim: publicar exige todos os confirmados escalados.
- Arrastar ou tocar? → Só tocar e tocar.
- Presença mudou depois de publicar? → Os times ficam como estão e o jogo trava até o admin corrigir.
- Reserva tem posição? → Sim, grava a principal (kickoff).

## QA
<Preenchido no fim: tabela final do QA, número de voltas e veredito.>
