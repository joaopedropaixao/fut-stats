# Atores e permissões

## Modelo de identidade

`User` representa login Google e não carrega papel de pelada. `Membership` vincula usuário e grupo, guarda `role`, posição, nota e `active`; o papel é por grupo (`@@unique([userId, groupId])`). `ADMIN` é uma associação de membro com permissões adicionais e pode estar em `TeamPlayer` como qualquer outro membro. `isHiredGoalkeeper` é dado de cadastro; a regra de jogador vem de `Membership`, não desse sinalizador. Fontes: [`schema.prisma`: `User`, `Group`, `Membership`, `TeamPlayer`](../../apps/api/prisma/schema.prisma); [`CONTEXT.md`: `Role`, goleiro contratado](../../CONTEXT.md).

## Matriz resumida

| Ator / estado | Pode ver | Pode fazer | Bloqueios verificados |
|---|---|---|---|
| Visitante com link válido | Prévia pública: nome do grupo e contagem de membros ativos | Seguir para login; após autenticar, entrar com apelido e posição | Prévia não lista nomes. Código inválido/rotacionado retorna 404. Fonte: `GroupsController.preview`, `GroupsService.preview` e `join` em [`apps/api/src/groups`](../../apps/api/src/groups/groups.controller.ts). |
| Autenticado sem vínculo ativo | `/me` e grupos em que já tem vínculo; prévia pública de convite | Criar grupo ou entrar pelo convite autenticado | Rotas do grupo exigem `Membership.active`; sem associação ativa, resposta 404. Convite não reativa inativo: 409 e contato com admin. Fonte: [`GroupAccessGuard`](../../apps/api/src/auth/group-access.guard.ts), [`GroupsService.join`](../../apps/api/src/groups/groups.service.ts). |
| PLAYER ativo no grupo | Rodadas, presença do grupo, times publicados, partida e dados permitidos pelas rotas de membro | Marcar a própria presença antes do jogo; na Resenha, lançar/apagar os próprios lances se jogou; consultar o que sua tela/contrato expõe | Não altera presença alheia; não edita/publica escalação; não inicia/fecha etapas; durante `IN_PROGRESS`, jogador comum não lança scout; lance alheio é negado. Fonte: `RoundsController`, `MatchController`, `LineupsController` e regras citadas abaixo. |
| ADMIN ativo no grupo | Mesmas informações de membro, mais ferramentas administrativas | Cadastrar/gerir membros, criar/editar rodadas, presença de qualquer membro em `SCHEDULED`/`TEAMS_PUBLISHED`, montar/publicar/despublicar, iniciar jogo, lançar/corrigir placar e lances de qualquer jogador, abrir votação | Papel é conferido na `Membership` ativa do `groupId` da rota. Ações continuam limitadas pelo estado e pré-condições da rodada. Admin sem `TeamPlayer` não tem resultado pessoal; como jogador escalado, tem. Fonte: controllers de grupos, rodadas, times e partida. |
| Membership inativa, ainda que role=ADMIN | Nenhuma rota protegida do grupo | Sem ações até reativação administrativa | `GroupAccessGuard` responde 404. Convite não reativa. |

## Presença, escalação e quem jogou

- Em `SCHEDULED`, a pessoa marca só a própria presença; admin pode marcar a de qualquer membro ativo. Ausência de linha `Attendance` significa pendente; `confirmed: false` é resposta explícita de não vou. Fonte: [`Attendance`](../../apps/api/prisma/schema.prisma), [`validateAttendanceChange`](../../packages/domain/src/round/attendance.ts), `RoundsService.detail/setAttendance`.
- Em `TEAMS_PUBLISHED`, só admin pode mudar presenças; a escalação não muda sozinha. A discrepância aparece como `ATTENDANCE_MISMATCH` e bloqueia início. A correção é despublicar, ajustar e publicar novamente. Fonte: [`validateAttendanceChange`](../../packages/domain/src/round/attendance.ts), [`LineupsService`](../../apps/api/src/lineups/lineups.service.ts), spec [montar-times](../specs/montar-times.md).
- Do início do jogo em diante, presença fica travada para todos. Publicar e iniciar exigem que o conjunto de confirmados ativos seja igual ao conjunto escalado. Titulares e reservas em `TeamPlayer` contam como quem jogou. Fonte: `validateAttendanceMatch` e `validateRoundTransition` em [`status.ts`](../../packages/domain/src/round/status.ts), [`schema.prisma`](../../apps/api/prisma/schema.prisma).
- Goleiro contratado continua membro pleno; a posição pode ser `GOALKEEPER`, mas contratação não cria papel ou privilégio especial. A participação em cada grupo pode ter role diferente para a mesma pessoa.

## Implicação para a visualização

A experiência é por `Membership` e estado da rodada, nunca por um papel global do usuário. A equipe de arquitetura deve mostrar admin como ator que também pode participar do jogo; elegibilidade para resultado/voto decorre de ter jogado, não de ser `ADMIN` ou `PLAYER`.
