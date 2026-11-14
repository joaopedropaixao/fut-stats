# Resultado pessoal: YOU WIN / YOU LOSE / EMPATE

## Regra e origem de `me.result`

O resultado não é papel de usuário. A API encontra o time da `Membership` em `TeamPlayer`, compara o placar com o oponente e calcula `matchResult(score, team)`. Só retorna valor quando a rodada está em `POST_MATCH`, `VOTING` ou `CLOSED`, existe placar e a pessoa tem time; nos demais casos `me.result` é `null`.

Cadeia confirmada:

1. [`MatchService.view`](../../apps/api/src/match/match.service.ts) deriva `myTeam` via `teamOf(membership.id, teams)` e `result` via `matchResult`.
2. [`packages/domain/src/round/match.ts`](../../packages/domain/src/round/match.ts) define `MATCH_RESULTS = WIN | LOSS | DRAW` e a comparação por time.
3. [`packages/shared/src/match.ts`](../../packages/shared/src/match.ts) define `matchViewSchema.me.result` como enum anulável; [`domain.ts`](../../packages/shared/src/domain.ts) deriva schema e textos `YOU WIN`, `YOU LOSE`, `EMPATE`.
4. [`match-page.tsx`](../../apps/web/src/pages/match/match-page.tsx) só mostra o card quando `me.result`, placar e time existem. Assim, quem não jogou não vê resultado pessoal.
5. [`result-card.tsx`](../../apps/web/src/features/match/result-card.tsx) anima/mostra o placar, anuncia resultado acessível e oferece “Pular”. [`result-seen.ts`](../../apps/web/src/features/match/result-seen.ts) guarda “já visto” por rodada no `localStorage`; falha ou armazenamento indisponível faz repetir a animação.

## Matriz de resultado

| Rodada / contexto | Resultado derivado | Efeito para admin e jogador |
|---|---|---|
| `SCHEDULED`, `TEAMS_PUBLISHED`, `IN_PROGRESS` ou sem placar/time | `null` | Sem card pessoal |
| `POST_MATCH`/`VOTING`/`CLOSED`, time ganhou | `WIN` | “YOU WIN”; banda do time e elementos festivos da vitória |
| Mesmas etapas, time perdeu | `LOSS` | “YOU LOSE”; sem celebração de vitória |
| Mesmas etapas, placar igual | `DRAW` | “EMPATE” |
| Não consta em titulares/reservas | `null` | Sem card, mesmo que seja admin |
| ADMIN escalado como titular/reserva | Igual a qualquer membro do seu time | Papel só adiciona comandos administrativos |
| Goleiro contratado escalado | Igual a qualquer membro do seu time | `isHiredGoalkeeper` não muda resultado |

Fonte funcional de verificação: `apps/api/src/match/match.spec.ts`, caso `C28` (vitória, derrota, não jogou e empate). O contrato é `MatchView.me.result`; não há endpoint de resultado independente.

## Etapas e repetição da animação

O card pode aparecer em `POST_MATCH`, antes de votação. A UI trata a animação como apresentação local: guarda o ID da rodada no navegador, não no servidor. Entrar de novo no mesmo navegador suprime a animação quando a chave existe; “Pular” termina a sequência e movimento reduzido mostra o quadro final sem confete. Se o armazenamento falhar, toca de novo. Isso não reabre nem altera a rodada.

`CLOSED` não pode voltar a uma etapa anterior. A única reabertura de fluxo é despublicar antes do jogo (`TEAMS_PUBLISHED → SCHEDULED`); portanto o mapa não prevê reabrir resultado ou votação. Fontes: [`ROUND_TRANSITIONS`](../../packages/domain/src/round/status.ts), [`ResultCard`](../../apps/web/src/features/match/result-card.tsx), [`result-seen.ts`](../../apps/web/src/features/match/result-seen.ts).
