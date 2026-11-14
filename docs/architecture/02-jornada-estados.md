# Jornada e estados da rodada

## Jornada por ator

| Etapa | Jogador | Admin | Sistema / validação |
|---|---|---|---|
| Convite, login e entrada | Abre prévia; autentica com Google; completa apelido/posição | Compartilha ou gira link; ao criar grupo, vira ADMIN | Prévia pública expõe nome e total ativo; entrada exige sessão; nova associação é PLAYER; associação inativa não é reativada pelo link. |
| Presença | Marca a própria resposta antes do jogo | Marca qualquer membro ativo antes do jogo; depois de publicar, ainda pode corrigir presença | `Attendance` diferencia pendente (sem linha), confirmado e declinou. Alterar presença após publicar não muda os times e pode bloquear início. |
| Gerar, ajustar e publicar | Vê times só depois de publicados | Gera sugestão, ajusta rascunho, salva e publica; se presença divergir, despublica e corrige | Sugestão de `balanceTeams` não grava por si só. Publicar exige formação válida e confirmados = escalados. |
| Jogo | Acompanha placar; não lança nem apaga scout em `IN_PROGRESS` | Inicia a partida e informa o placar final; também não lança nem apaga scout durante `IN_PROGRESS` | Início exige escalação válida e presença igual. `validateMatchEvent` e `validateMatchEventRemoval` bloqueiam todos os atores fora de `POST_MATCH`. |
| Resenha (`POST_MATCH`) | Se jogou, vê resultado pessoal e pode lançar/apagar só os próprios scouts; votar é opcional | Corrige placar e lança/apaga scout de qualquer membro que jogou; abre votação quando os gols lançados batem com placar | Para entrar em Resenha, placar precisa existir e ser inteiro/não negativo. Gols podem ainda não bater; precisam bater para abrir votação. Assistências são soltas e não alteram nem limitam o placar. Placar e lances congelam em `VOTING`. |
| Votação | **Previsto/parcial:** quem jogou (titular/reserva, goleiro incluso) pode optar por votar; membro que não jogou vê contagem/resultado, sem votar | **Previsto:** se jogou, admin também vota; pode encerrar antes do prazo e ver quem falta | Quem vota envia pacote de nota para todos os outros que jogaram, Craque e Perna de Pau; voto é anônimo. Enum `VOTING`, cálculo de elegibilidade e regra `shouldCloseVoting` existem. Não há persistência/API de voto ou rota de fechamento no código atual (ver divergências no README e em [requisitos](./04-requisitos-r1.md)). |
| Encerramento, histórico e ranking | **Previsto:** consulta dados encerrados | **Previsto:** mesma consulta | Domain permite `VOTING → CLOSED` com placar/gols coerentes, mas não implementa ação API de fechamento. Não desenhar gravação de votos/ranking como verificada nesta rodada. |

Fontes de convite e identidade: `GroupsController`, `GroupsService`, `GoogleAuthController`; fontes da partida: [`MatchController`](../../apps/api/src/match/match.controller.ts), [`MatchService`](../../apps/api/src/match/match.service.ts), [`status.ts`](../../packages/domain/src/round/status.ts). Specs de intenção: [placar-e-lances](../specs/placar-e-lances.md), [votacao](../specs/votacao.md), [historico](../specs/historico.md), [ranking](../specs/ranking.md).

## Máquina de estados verificada

`SCHEDULED → TEAMS_PUBLISHED → IN_PROGRESS → POST_MATCH → VOTING → CLOSED`

Única volta implementada: `TEAMS_PUBLISHED → SCHEDULED` para despublicar antes do jogo. Não existe transição após `CLOSED`.

| Transição | Pré-condições confirmadas no domínio | Ação disponível na API atual |
|---|---|---|
| `SCHEDULED → TEAMS_PUBLISHED` | Dois times 1-2-3-1 válidos, até 2 reservas por time, sem duplicatas e confirmados = escalados | Admin publica por `POST .../lineup/publish` |
| `TEAMS_PUBLISHED → SCHEDULED` | Só a transição de despublicação | Admin `POST .../lineup/unpublish`; rascunho é preservado |
| `TEAMS_PUBLISHED → IN_PROGRESS` | Mesma validação de times e presença | Admin `POST .../match/start` |
| `IN_PROGRESS → POST_MATCH` | Placar presente e válido; gols lançados ainda podem divergir | Admin `POST .../match/finish` com placar final |
| `POST_MATCH → VOTING` | Gols lançados por time batem com placar; assistências não entram nessa comparação | Admin `POST .../match/open-voting`; grava `votingOpenedAt`; congela placar/lances |
| `VOTING → CLOSED` | Placar válido e gols lançados coerentes | Regra existe em `validateRoundTransition`; nenhuma rota API de fechamento encontrada |

`SCHEDULED`/`TEAMS_PUBLISHED` permitem editar/remover rodada. Em `IN_PROGRESS`+, rodada e presença não mudam. `pickCurrentRound` seleciona rodadas em jogo ou Resenha; votação e encerrada deixam de ser a rodada atual. Fontes: [`status.ts`](../../packages/domain/src/round/status.ts), [`current.ts`](../../packages/domain/src/round/current.ts), [`RoundsService`](../../apps/api/src/rounds/rounds.service.ts).

## Scouts e regras de bloqueio

- `MatchEvent` separa quem fez (`membershipId`) de quem registrou (`createdById`); cada evento tem rodada, autor e data. Isso permite distinguir autoria de lance de autoria do registro.
- Scouts (`GOAL`, `ASSIST`, `OWN_GOAL`) só podem ser lançados ou apagados em `POST_MATCH`. Jogador participante altera os próprios; admin pode gerir qualquer participante. Em `IN_PROGRESS`, todos — inclusive admin — recebem `ROUND_NOT_OPEN` para scout. Quem não jogou não pode lançar.
- Assistência é solta: não participa da validação entre gols registrados e placar. Para abrir votação/encerrar, o domain compara apenas a contagem de gols (incluindo gols contra para o adversário) com o placar.
- `OWN_GOAL` aparece como lance de quem fez, mas soma no placar do adversário. Assistência é contabilizada à parte.
- Em `VOTING`/`CLOSED`, alteração de lances/placar é recusada (`ROUND_NOT_OPEN`).

Fontes: [`MatchEvent`](../../apps/api/prisma/schema.prisma), `isMatchOpen`, `validateMatchEvent`/`validateMatchEventRemoval` em [`events.ts`](../../packages/domain/src/round/events.ts), `validateScoreMatchesEvents` em [`status.ts`](../../packages/domain/src/round/status.ts), `tallyMatchEvents` em [`match.ts`](../../packages/domain/src/round/match.ts).
