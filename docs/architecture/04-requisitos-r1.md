# Requisitos e rastreabilidade — rodada 1

Legenda: **V** verificado em código; **P** previsto em documento/regra parcial, sem comprovação ponta a ponta; **H** hipótese/proposta de revisão; **D** dúvida aberta. Documento de intenção nunca serve sozinho como prova de implementação.

| ID | Status | Jornada → regra/permissão → componente → validação | Evidência |
|---|---|---|---|
| A1 | V | Convite → prévia pública limitada → UI `InvitePage`/`InviteTicket`; contrato `InvitePreview`; `GroupsController.preview`/`GroupsService.preview` → `GET /api/invites/:code` | `apps/web/src/pages/entrar-e-grupo/invite-page.tsx`, `packages/shared/src/group.ts`, `apps/api/src/groups/groups.controller.ts`, `groups.service.ts`; `CONTEXT.md` “Grupo, convite e entrada” |
| A2 | V | Entrada → sessão obrigatória, cria `PLAYER`; inativo não reativa → `Membership` → `POST /api/invites/:code/join` | `GroupsController.join`, `GroupsService.join`, `validateJoinGroup`; `groups-edge.spec.ts` |
| A3 | V | Acesso ao grupo → participação ativa no `groupId` da rota → `GroupAccessGuard`/`GroupRole` → 404 sem Membership ativa, 403 sem role exigido | `apps/api/src/auth/group-access.guard.ts`, `group-access.spec.ts` |
| A4 | V | Presença → jogador próprio/admin qualquer antes do jogo; admin ainda corrige após publicar → `Attendance`, `use-presence.tsx` → `validateAttendanceChange` e `ATTENDANCE_CLOSED`/`ATTENDANCE_MISMATCH` | `packages/domain/src/round/attendance.ts`, `status.ts`, `RoundsService`, `rounds.spec.ts` |
| A5 | V | Escalação → admin gera/edita/publica; presença mudou requer correção → `LineupBuilder`/`lineup` → `validateRoundTeams`, `validateAttendanceMatch`, `publish` | `apps/api/src/lineups`, `packages/domain/src/round/status.ts`, spec [montar-times](../specs/montar-times.md) |
| A6 | V | Partida → admin inicia e finaliza com placar; nenhum ator lança/apaga scout em `IN_PROGRESS`; em `POST_MATCH`, jogador altera o próprio e admin qualquer participante; assistência é solta → `MatchView`/`MatchPage` → `isMatchOpen`, `validateMatchEvent`, `validateMatchEventRemoval`, transição compara gols com placar, lock/transação por rodada | `MatchController`, `MatchService`, `events.ts`, `status.ts`, `match.spec.ts` |
| A7 | V | Resenha → `me.result` só para quem jogou e com placar; role não determina vitória → `ResultCard` → `matchResult` e `matchViewSchema` | `MatchService.view`, `round/match.ts`, `shared/match.ts`, `match.spec.ts C28` |
| A8 | P | Votação → quem jogou pode enviar/editar pacote completo; admin vota se jogou; membro que não jogou vê progresso, admin também vê quem falta; voto anônimo → API/UI/storage ainda não confirmado no código → contrato futuro do spec aprovado | `packages/domain/src/round-score/vote.ts`; spec aprovado [votacao](../specs/votacao.md), seções Produto, cenários e Técnico; ausência de model de voto/rotas em schema/API |
| A9 | P | Fechamento → todos votaram, prazo, ou admin; votos congelam após fechar → tela/rota de fechamento pendente → `isVotingOpen`, `votingCloseReason`, transição `VOTING → CLOSED` | `packages/domain/src/round/voting.ts`, `status.ts`; nenhum controller/service de voto no API atual |
| A10 | P | Histórico/ranking → resultados agregados depois de encerrar → telas e dados dependentes de votos → validação ponta a ponta fora desta revisão | `docs/specs/historico.md`, `ranking.md`; leitura de implementação deve confirmar antes de elevar a V |
| A11 | V | Resultado pessoal respeita movimento reduzido, anuncia texto acessível, move foco após animação; “já visto” é local por rodada e falha de `localStorage` repete a animação sem quebrar o fluxo | `apps/web/src/features/match/result-card.tsx`, `result-seen.ts`; `match-page.tsx` |
| A12 | H | Auditoria ampla futura de acessibilidade, teclado, leitor de tela e comportamento em diferentes navegadores/dispositivos | Proposta de aprofundamento na rodada 3; não é requisito não implementado inferido a partir do card atual |

## Divergências doc/spec/código

- **Scouts na partida:** `docs/specs/placar-e-lances.md` e comentário de `matchPermissionsSchema` em `packages/shared/src/match.ts` descrevem admin lançando em `IN_PROGRESS`; a regra efetiva em `events.ts` (`isMatchOpen`) permite scout somente em `POST_MATCH` para todos. `MatchService.view` também calcula `launchAny` a partir de `isMatchOpen`. Esta revisão registra o comportamento do código sem alterar regra, contrato ou CONTEXT.
- **Assistências:** o spec antigo `docs/specs/placar-e-lances.md` inclui assistência na condição de abertura; `validateScoreMatchesEvents` em `status.ts` compara somente gols lançados com placar. `events.ts` trata assistência como solta e não limita pela contagem de gols. A transição atual não exige `assistências ≤ gols`.
- **Votação:** o spec [votacao](../specs/votacao.md) aprovado em 14/11/2026 descreve pacote, persistência e rotas-alvo. No código atual há enums e funções de domínio de elegibilidade/fechamento, porém faltam models `Vote`/`Rating`, serviço/rota de votos e comando API para fechar. Mapas marcam o contrato-alvo como **P**, não como implementado.
- **Fechamento:** `validateRoundTransition` conhece pré-condições para `CLOSED`, e `votingCloseReason` decide `ALL_VOTED`/`DEADLINE_PASSED`; não há rotina de persistência/endpoint de fechamento verificado.
- **Acompanhamento documental:** [02-arquitetura.md](../02-arquitetura.md) é arquitetura inicial e antecede partes da implementação; usar código atual como fonte para status real.

## NFRs para aprofundar nas rodadas seguintes

Sem metas aceitas nesta rodada. Dimensionamentos futuros podem usar cenários hipotéticos nomeados, nunca benchmarks nem capacidade contratada.

- Carga, usuários ativos/simultâneos e limites de crescimento.
- Isolamento por `groupId` e autorização em cada rota/consulta.
- Sessão, OAuth/PKCE, cookies, expiração e revogação.
- Concorrência, transações, lock da rodada e idempotência.
- Cache, atualização e tempo real/refetch.
- Logs, métricas, rastreamento e tratamento de falhas.
- Estratégia de testes unitários, integração e navegador.
- Acessibilidade, teclado, leitor de tela e movimento reduzido.
- Deploy, ambientes, migrações e rollback.
- Backup, recuperação e objetivos de recuperação ainda não definidos.
- Custos recorrentes, limites de planos gratuitos e manutenção por uma pessoa.

## Dúvidas

- Nenhuma pergunta de produto é necessária para fechar este rascunho. O spec `votacao` está aprovado em 14/11/2026 e serve como solução-alvo documentada; as pranchas continuam distinguindo esse alvo do que está implementado no SHA analisado. Uma mudança posterior de regra ou contrato depende do dono.

## Referências de arquitetura consultadas

- Modelo atual: [`apps/api/prisma/schema.prisma`](../../apps/api/prisma/schema.prisma).
- Regras: [`packages/domain/src/round/status.ts`](../../packages/domain/src/round/status.ts), [`attendance.ts`](../../packages/domain/src/round/attendance.ts), [`events.ts`](../../packages/domain/src/round/events.ts), [`voting.ts`](../../packages/domain/src/round/voting.ts), [`round-score/vote.ts`](../../packages/domain/src/round-score/vote.ts).
- Contratos/API: [`apps/api/src/auth/group-access.guard.ts`](../../apps/api/src/auth/group-access.guard.ts), `groups`, `rounds`, `lineups`, `match` controllers/services; [`packages/shared/src/match.ts`](../../packages/shared/src/match.ts).
- Web: [`apps/web/src/pages/match/match-page.tsx`](../../apps/web/src/pages/match/match-page.tsx), [`apps/web/src/features/match/result-card.tsx`](../../apps/web/src/features/match/result-card.tsx), [`result-seen.ts`](../../apps/web/src/features/match/result-seen.ts).
