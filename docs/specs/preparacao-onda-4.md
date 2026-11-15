# Preparação da Onda 4

Revisão documental preparatória de `ranking`, `pacote-do-craque` e `auditoria-da-rodada`. Não aprova mudanças de produto, não altera os specs existentes e não autoriza implementação antes das dependências na `develop`.

## Base e portões

- Base conferida: `origin/develop` em `7e3902d` (15 nov 2026); o worktree de preparação parte do mesmo commit. Os três specs aprovados ainda registram `develop @1021769`.
- `ranking`: **bloqueado** até `votacao` e `perfil-jogador` estarem na `develop`.
- `pacote-do-craque`: **bloqueado** até `votacao` estar na `develop`.
- `auditoria-da-rodada`: **bloqueado** até `votacao` e `rodizio-reservas` estarem na `develop`.
- A Onda 4 inteira só pode ser lançada quando as dependências acima estiverem integradas e os specs continuarem `Status: aprovado`. A atividade observada de Votação e Rodízio em outros worktrees não satisfaz esse portão. Este documento não altera o estado deles.

## Contratos de dependência

### Votação

O contrato aprovado em `docs/specs/votacao.md` é a fonte para as três fatias:

- Leitura e escrita sob `/api/groups/:groupId/rounds/:roundId/voting`: `GET /`, `PUT /vote`, `POST /close` e `GET /result`.
- `RoundResult` expõe `mvps`, `flops` e `players`; cada resultado de jogador traz `score` (nullable), contagem de notas, classificação da rodada, eventos e selos. `TeamPlayer` recebe `roundScore`, `ratingsCount`, `isMvp` e `isFlop` no fechamento.
- Votos são anônimos. A auditoria registra o fechamento, nunca o voto nem a identidade de quem votou. Ranking lê os dados gravados após `CLOSED`; pacote consome `mvps` do resultado e `lastResult` na lista de rodadas.
- Votação e Rodízio dependem de escritas serializadas por rodada. O spec de Votação extrai `withRoundLock` para `apps/api/src/rounds/round-lock.service.ts`; preservar a trava nas escritas de Rodízio e nos novos fluxos. A integração deve revalidar concorrência de início/fim do jogo, voto/fechamento e lances conforme os respectivos specs.
- O deadline de 24 h e a atualização dos grupos existentes para 24 h estão definidos no spec aprovado de Votação; não recalibrar isso nesta preparação.

### Rodízio

O contrato aprovado em `docs/specs/rodizio-reservas.md` permanece:

- Sob `/api/groups/:groupId/rounds/:roundId/match`: `POST /rotation`, `DELETE /rotation` e `GET /`. A visão adiciona `rotation` e `serverTime`; a permissão `rotate` reflete admin, jogo `IN_PROGRESS` e reservas disponíveis.
- `Round` ganha `rotationStartedAt` e `rotationMinutes`; o Domain calcula o plano por time, sem goleiro, com relógio compartilhado e ordem estável por rodada.
- O rodízio não altera quem jogou, resultado, votação ou auditoria. Campos podem permanecer após o fim, mas a visão só mostra rodízio durante `IN_PROGRESS`.
- Para auditoria, a exclusão de alterações de rodízio do `RoundLog` é explícita. Não ampliar a lista de ações do log.

## Divergências verificadas

1. **Base mudou:** `origin/develop` está em `7e3902d`; os três specs usam `@1021769`. É um registro histórico válido, não motivo para mudar o status aprovado. No kickoff futuro, comparar a base atual e revalidar os caminhos citados.
2. **Dependências ainda não estão na base:** em `origin/develop`, o schema ainda não tem `Vote`, `Rating`, os campos de resultado em `TeamPlayer`, `RoundLog` ou campos do Rodízio. As rotas/pastas novas de Votação, Auditoria, Ranking de API e pacote também não existem. Isso corresponde às dependências ainda em andamento e bloqueia os lançamentos; não é uma falha a corrigir nesta preparação.
3. **Prazo legado:** `apps/api/prisma/schema.prisma` em develop ainda tem `Group.votingDeadlineHours @default(48)` e `CONTEXT.md` descreve o prazo como não definido. O spec aprovado de Votação fixa 24 h e prevê migração dos grupos existentes. Aplicar essa mudança somente na entrega de Votação, com registro de domínio no mesmo PR; não alterar `CONTEXT.md` aqui nem reinterpretar a decisão.
4. **Ranking parcial já existe:** `packages/domain/src/ranking/rank.ts` e `rankByRating` estão em develop; `CONTEXT.md` marca a entrada como 🚧 e descreve a nota atual como inicial. O spec aprovado de Ranking mantém `rankByRating`, adiciona estatísticas, classificação e nota de referência e exige atualizar o contexto. Não assumir que as peças novas ou as rotas/telas estejam prontas.
5. **Tela do resultado ainda não existe:** os componentes atuais incluem `features/match/result-card.tsx` e `features/lineup/vs-board.tsx`, mas não há `pages/voting/result-page.tsx` nem `features/voting` em develop. O pacote deve aplicar-se ao arquivo que a Votação realmente entregar, confirmando o caminho no checkpoint, e reusar a carta revelada em vez de duplicá-la.

## Cruzamentos de arquivos e integração

| Fatia | Cruzamentos principais | Acordo para integrar |
|---|---|---|
| `auditoria-da-rodada` | `apps/api/src/lineups/lineups.service.ts`, `apps/api/src/app.module.ts`; também `apps/api/src/match`, `apps/api/src/voting`, `apps/api/src/rounds/round-lock.service.ts`, `apps/api/src/common`, `setup-app.ts` e `main.ts` | É a única dona do `schema.prisma` na onda. Após Votação e Rodízio na develop, integrar primeiro ou coordenar o conflito mecânico desses dois arquivos com Ranking. Registrar cada transição/evento na mesma transação; voto e rotação continuam fora do log. |
| `ranking` | `lineups.service.ts`, `rounds.service.ts`, `app.module.ts`, `router.tsx`, `pages/perfil` | Sem schema. Faz a nota de referência alimentar lista de presença, escalação e sugestão. Se Auditoria entrar primeiro, Ranking rebaseia; se Ranking entrar primeiro, Auditoria rebaseia. Não misturar os comportamentos. |
| `pacote-do-craque` | `features/voting`, `pages/voting/result-page.tsx`, `features/pack`, `index.css`, `pixel-sprite-maps.ts` | Sem API, domain ou banco. Sem cruzamento esperado com Auditoria/Ranking. Verificar o caminho real de resultado após Votação e preservar `RoundResult.mvps`/carta revelada. |

**Ordem de integração recomendada:** (1) integrar `rodizio-reservas` conforme seu QA e depois `votacao`, rebaseando Votação sobre Rodízio se necessário por `Round`, `match` e trava; (2) aguardar ambos na `develop` e abrir o portão da Onda 4; (3) integrar `auditoria-da-rodada` e `ranking` em sequência, com rebase do segundo e validação dos cruzamentos; (4) integrar `pacote-do-craque` após Votação, livre em relação às outras duas quando sua dependência estiver satisfeita. A ordem interna de Auditoria e Ranking é mecânica, desde que o segundo rebaseie e preserve contratos. Nenhum merge é autorizado por este documento.

## Briefings para lançamento futuro

Os três briefings abaixo são rascunhos operacionais, subordinados aos specs aprovados. Em cada kickoff, conferir novamente a base, os caminhos e o bloqueio de dependências. A referência visual é `docs/design/DESIGN.md`, a folha existente e os exemplos atuais; Paper ficou para depois por decisão do dono. QA cria o álbum em `docs/design/prints/<fatia>/` conforme autonomia v1. Não iniciar implementação antes do portão.

### Brief: `ranking` — Par

**Bloqueio:** aguardar `votacao` e `perfil-jogador` integrados na `develop`; confirmar `RoundResult`/`TeamPlayer` gravados e avatar/perfil disponíveis. **Spec:** `docs/specs/ranking.md` aprovado em 14 nov 2026; não reabrir decisões.

Entregar ranking geral, por posição e goleiros, perfil de jogador, tendência e nota de referência. Back: estender `packages/domain/src/ranking`, criar schemas compartilhados e módulo/rotas de ranking, integrar com `rounds.service.ts` e `lineups.service.ts`; sem migration. Front: rotas lazy, lista, abas, figurinha/estatísticas e bloco no Perfil conforme spec. Atualizar `CONTEXT.md` no mesmo PR para as entradas novas. Toca em: caminhos indicados no cabeçalho do spec. Critérios: cenários C1–C36, testes unitários/integrados/Playwright e álbum; preservar ranking existente por empate e nota nula.

### Brief: `pacote-do-craque` — Front

**Bloqueio:** aguardar `votacao` integrada na `develop`, com página do resultado, `RoundResult.mvps` e carta revelada disponíveis. **Spec:** `docs/specs/pacote-do-craque.md` aprovado em 14 nov 2026; manter o resultado utilizável sem abrir o pacote.

Implementar abertura em fases, pular/rever, preferência local por rodada, miniatura do início e compartilhamento em PNG/WhatsApp, sem contrato/API/domain/banco/dependência novos. Reusar a carta de Votação e os mapas pixel; conferir o caminho real da página no kickoff. Toca em: `apps/web/src/features/pack`, `features/voting`, página de resultado, `index.css` e `pixel-sprite-maps.ts`. Critérios: cenários C1–C19, folha visual e DESIGN.md; QA entrega álbum e larguras estreita/desktop.

### Brief: `auditoria-da-rodada` — Back

**Bloqueio:** aguardar `votacao` e `rodizio-reservas` integrados na `develop`, incluindo todas as escritas que o log deve cobrir e a trava compartilhada. **Spec:** `docs/specs/auditoria-da-rodada.md` aprovado em 14 nov 2026; RoundLog é o único model novo da Onda 4.

Adicionar vocabulário de domínio, schema/índice/migration, `RoundLog`, contexto e cabeçalho `x-request-id`, logging e rota administrativa de leitura. Instrumentar transições de match, publicação/despublicação de times, eventos e fechamento de votação na mesma transação. Não registrar voto, presença, rascunho nem rodízio. Toca em: caminhos do cabeçalho do spec; coordenar `lineups.service.ts` e `app.module.ts` com Ranking. Atualizar `CONTEXT.md` no mesmo PR. Critérios: cenários C1–C20 e integração na aplicação real, sem nova tela; revalidar a cobertura de todas as rotas de escrita de rodada.

## Escopo desta revisão

Somente este documento é novo. Os status aprovados dos specs existentes e os itens do roadmap permanecem inalterados. Nenhuma dependência entrou na `develop` durante a preparação; os três briefings continuam bloqueados pelos portões descritos acima.
