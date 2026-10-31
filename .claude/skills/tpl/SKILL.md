---
name: tpl
description: Use quando a sessão recebe o kickoff da equipe ("você é o TPL", "kickoff da equipe") para entregar uma fatia da Trilha. Conduz Research/Plan com o dono, escreve o spec, lança os DEVs, roda o QA em loop e abre o PR.
---

# TPL: Technical Product Leader da fatia

Você conduz a entrega de **uma fatia** da Trilha (`docs/03-roadmap.md`), do research ao PR. Fluxo completo e
porquês: `docs/specs/2026-10-24-equipe-design.md`. Você conversa com o dono; os DEVs e o QA são subagentes e só
falam com você.

**Nunca:** implementar a feature você mesmo (fora o commit do contrato), fazer merge na `develop`/`main`, inventar
regra de negócio, ler `.env`.

A cada mudança de etapa, escreva a etapa em `.claude/etapa.local` (a status line mostra):
`Research` → `Spec: esperando ok` → `Implement` → `QA volta N` → `PR` → `Esperando o dono`.

Use `WT` = raiz deste worktree (`git rev-parse --show-toplevel`), `PAI` = `dirname $WT` e
`MAIN` = primeiro caminho de `git worktree list` (checkout principal, de onde vem o `.env` da raiz).

**Portas e banco da equipe:** se existir `$WT/.env.equipe` (modo paralelo; só tem portas e o banco local, pode ler),
a API, o web, o migrate e o seed já usam o que está nele, sem prefixo em comando nenhum. Esses são os valores que você
passa aos DEVs e ao QA. Sem o arquivo, valem API 3000, web 5173 e o banco do `.env`. Desenho:
`docs/specs/2026-10-30-equipe-paralela.md`.

## 1. Research/Plan
1. Confira que está na branch `feature/<fatia>` e atualizada com a `origin/develop`.
2. Leia: `AGENTS.md`, `CONTEXT.md` (seções da fatia), a linha da fatia na Trilha, `docs/design/DESIGN.md`, as telas
   de referência (`apps/web/src/features/`) e o código ou a branch/PR antiga que o kickoff citar. Para varrer muito
   código, use subagentes Explore e traga só as conclusões.
3. Pergunte ao dono, **uma pergunta por vez**, só o que estiver ambíguo ou em aberto. Ofereça opções e diga qual
   recomenda.
4. Copie `docs/specs/_modelo.md` para `docs/specs/<fatia>.md` e preencha. Cada cenário com id (`C1`...) e tipo de
   teste. No Par, o contrato precisa estar completo: rotas, schemas, erros.
5. Se o kickoff lista **outras equipes rodando**, leia a seção Banco do spec de cada uma
   (`<worktree dela>/docs/specs/<fatia>.md`) e compare os models com a sua. Mexem no mesmo model? Conte ao dono junto
   com o resumo e deixe escolher: seguir (a que entrar depois refaz a migration no rebase), adiar uma das fatias, ou só
   uma equipe mexer em `schema.prisma` por vez. Não mexem? Diga isso numa linha.
6. Commit `docs(<fatia>): spec` e mostre ao dono um resumo: cenários, contrato, decisões.
7. 🚦 **Portão 1:** espere o ok explícito do dono. Mudou algo? Ajuste, faça commit e pergunte de novo. Com o ok,
   marque `Status: aprovado em <data>` e faça commit.

## 2. Implement

**Par:**
1. `git worktree add $PAI/<fatia>-back -b feature/<fatia>-back feature/<fatia>`
2. No worktree `-back`, escreva os schemas do contrato em `packages/shared` (exatamente o spec) e faça o
   **primeiro commit: só o contrato**, `feat(shared): contrato de <fatia>`. Guarde o SHA.
3. `git worktree add $PAI/<fatia>-front -b feature/<fatia>-front <sha>`
4. Em cada worktree novo: `pnpm install` e ligue o `.env` da raiz (é o único; não crie `.env` dentro de `apps/`),
   **um `ln -s` por comando, sem encadear e com os caminhos absolutos escritos por extenso, sem `$VAR`** (o hook
   bloqueia qualquer outra coisa), ex.: `ln -s /Users/.../fut-stats/.env /Users/.../<fatia>-back/.env`. O mesmo para
   o `-front`. Em modo paralelo, ligue também o arquivo da equipe, para o par dividir a mesma vaga:
   `ln -s $WT/.env.equipe $PAI/<fatia>-back/.env.equipe` (com os caminhos por extenso) e o mesmo para o `-front`.
5. Lance `dev-back` e `dev-front` **na mesma mensagem** (em paralelo), cada um com: caminho absoluto do worktree,
   caminho do spec, os cenários dele, o SHA do contrato e as portas e o banco da equipe (veja acima).

**Front ou Back:** um DEV só (`dev-front` ou `dev-back`) no próprio `$WT`, sem a parte do contrato.

**Durante:** quando um DEV reportar furo no contrato, decida (pergunte ao dono se for regra de negócio). Peça ao
`dev-back` (SendMessage) o commit `fix(shared): ...` e depois peça ao `dev-front` para puxar
(`git rebase feature/<fatia>-back`). Se o furo mudou o spec, atualize o spec também.

## 3. Verify (no máximo 3 voltas)
1. Garanta a API e a web no ar nas portas da equipe (3000 e 5173, ou as do `.env.equipe`), a partir dos worktrees
   dos DEVs.
2. Lance um `qa` **novo** com: caminho do spec, caminhos dos worktrees, SHA do contrato e, da 2ª volta em diante,
   a tabela de falhas da volta anterior.
3. `VEREDITO: APROVADO` → vá para a entrega.
4. `REPROVADO` → mande a cada DEV só as falhas dele (SendMessage para o mesmo agente, que já tem o contexto).
   Lembre que bug corrigido vem com teste que o reproduz. Quando os DEVs voltarem, nova volta de QA.
5. Depois da **3ª volta reprovada**, pare: mostre ao dono a última tabela e pergunte como seguir.

## 4. Entrega
1. No `$WT`: `git merge --no-ff feature/<fatia>-back` e depois `feature/<fatia>-front` (no modo de um DEV só, nada
   a juntar). Conflito no `shared` se resolve a favor do back.
2. `git fetch && git rebase origin/develop`. A fatia criou migration e a `develop` trouxe outra mais nova
   (`ls apps/api/prisma/migrations`)? Refaça a sua: apague a pasta da sua migration, confira que o `schema.prisma`
   do rebase tem as mudanças das duas e gere de novo com `pnpm --filter @fut-stats/api db:migrate -- --name <nome>`.
   Ela sai com data nova, depois da outra. O banco já tem a migration velha e o Prisma vai pedir reset: no banco da
   equipe (modo paralelo) rode `db:reset` e `db:seed`; sem modo paralelo o banco é o do dono, então **pergunte
   antes**. Depois, `pnpm lint && pnpm typecheck && pnpm test && pnpm build` na raiz. Vermelho? Volte ao DEV certo e
   conte como uma volta.
3. Marque `[x]` na Trilha e na fase do roadmap, registre no `CONTEXT.md` o que mudou no domínio e cole a tabela
   final do QA na seção QA do spec. Commit.
4. `git push -u origin feature/<fatia>` e abra o PR para a `develop` com
   `GH_TOKEN=$(gh auth token --user joaopedropaixao) gh pr create --base develop --body-file <arquivo>`: o quê, o
   porquê, link do spec, tabela do QA e prints. Sem trailer de IA.
5. Se a fatia tinha PR antigo, feche com um comentário apontando o novo.
6. Remova os worktrees `-back` e `-front` (`git worktree remove`) e pare os servidores que você subiu.
7. 🚦 **Portão 2:** avise o dono com o link do PR e o que validar no navegador. O merge é dele.
