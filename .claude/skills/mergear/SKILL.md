---
name: mergear
description: Use na sessão do orquestrador quando o dono pedir para mergear PRs ("mergeia", "faz os merges", "lança o merge de tudo"). Lista os PRs prontos, propõe a ordem, pede o ok do dono e faz o merge um por um, resolvendo rebase e conflito no caminho.
---

# Mergear PRs (orquestrador)

Leia também `.harness/operacao.md` para identidade pessoal, reservas conjuntas e recuperação.
Este é o fluxo Claude; preserve seus modelos e subagentes nativos. Em sessão Codex, use
`.agents/skills/mergear/SKILL.md` (mergear compartilha este procedimento com seu adaptador).
Todo fetch/push/pull abaixo usa `sh .claude/scripts/git-pessoal.sh <operação>`, mesmo quando
abreviado no texto. Nunca usar a credencial GitHub padrão.


O merge na `develop` é do orquestrador, **sempre com o ok explícito do dono, nesta conversa, para os PRs listados**.
O hook `sem-merge` só libera `gh pr merge` no checkout principal; TPL, DEVs e QA continuam sem poder. Push direto na
`develop`/`main` ninguém faz: tudo entra por PR.

Use `GH="GH_TOKEN=$(gh auth token --user joaopedropaixao) gh"` em todo comando do GitHub.

O Orca é a ferramenta de worktrees e agentes do dono. Antes do primeiro comando `orca` da sessão, carregue os
guias da versão instalada: `orca skills get orchestration` e `orca skills get orca-cli` (as skills `orchestration`
e `orca-cli`). Não faça polling nem script de espera: o Orca te acorda quando um worker pergunta ou termina.

## 1. Levantar e propor
0. Rode `sh .claude/scripts/checar-atraso.sh` e `sh .claude/scripts/quadro.sh show`: mostre ao dono, junto da
   tabela, o que está atrasado ou sem push.
1. `git fetch origin` e `gh pr list --state open`. Para cada PR: CI (`gh pr checks`), `mergeable`/`mergeStateStatus`,
   o que o TPL/QA disse no corpo (veredito do QA) e se depende de outro ("Depende de", "merge do #N primeiro").
2. **Ordem:** dependências primeiro; depois o que mexe em `schema.prisma` (migration) antes do resto; entre os
   demais, o mais antigo/pronto primeiro. Veja a sobreposição de arquivos entre os PRs
   (`gh pr diff <n> --name-only`) para prever conflito.
3. **Worktree local à frente do remoto?** Compare `git -C <worktree> rev-parse HEAD` com
   `origin/<branch>`. Se o local tem commits que o PR não tem (ex.: rebase feito e não enviado), conte ao dono.
4. Mostre ao dono uma tabela: PR, o quê, estado (CI, conflito, QA), ação prevista (merge direto / rebase antes /
   esperar). 🚦 **Espere o ok.** Ok vale só para os PRs da tabela; PR novo depois disso, pergunte de novo.

## 2. Mergear, um por vez, na ordem
Para cada PR:
1. Atualizado e verde (`MERGEABLE`, CI ok): `$GH pr merge <n> --merge`.
2. **Atrás da `develop` ou em conflito:** no worktree da branch (crie um se não existir:
   `git worktree add ~/orca/workspaces/fut-stats/<branch-sem-feature> <branch>`):
   - `git -C <wt> fetch origin && git -C <wt> rebase origin/develop`;
   - conflito: resolva **só** o que é mecânico (marcas do roadmap, linhas vizinhas, imports, `app.module.ts`). Se
     o conflito mexe em regra de negócio, contrato ou migration de outra fatia, **pare e pergunte**. Migration
     velha depois de outra mais nova: siga o passo 2 da Entrega da skill `tpl`;
   - rode o "pronto" no worktree (`pnpm lint && pnpm typecheck && pnpm test && pnpm build`), com a saída num arquivo
     e só o fim no contexto;
   - `git -C <wt> push --force-with-lease=<branch>:<sha remoto antigo> origin <branch>`;
   - espere o CI (`$GH pr checks <n> --watch`) e então faça o merge.
3. CI vermelho que não é seu: pare e conte ao dono, com o trecho do erro.
4. Depois de cada merge: `git pull --ff-only` no checkout principal e confira se o próximo PR ficou em conflito.
5. **Checkpoint de merge (avisar as equipes):**
   - `$GH pr diff <n> --name-only | sh .claude/scripts/quadro.sh afetados` lista as fatias ativas cujo **Toca em**
     cruza o que entrou;
   - para cada uma: `quadro.sh aviso <fatia> "develop mudou: #<n> mexeu em <arquivos>; <o que fazer>"` (rebase,
     rever contrato, refazer migration) e mande a mesma frase ao TPL dela pelo Orca. Ache o worker pelo worktree
     (`orca orchestration worker-list --json`, o `workspace` termina em `/<fatia>`) e
     `orca orchestration send --to dispatch:<dispatchId> --subject "develop mudou" --body "<a frase>"`. O worker
     recebe no fim do turno atual, mesmo ocupado. Sem worker (sessão aberta à mão): o quadro é o que vale;
   - as demais fatias ativas só precisam de rebase no próximo checkpoint: não precisa avisar;
   - a fatia mergeada sai do quadro: `quadro.sh rm <fatia>`.

## 3. Arrumar
0. Preserve sempre feature/plugin-harness e seu worktree (AGENTS.md). Para outras fatias,
   siga settle/release de `.harness/operacao.md` somente após confirmar workers e servidores encerrados.
   Worker do Orca da fatia mergeada (`orca orchestration worker-list --json`): ele foi mantido aberto para o dono.
   Se o dono não vai mais usar o chat, conte isso a ele e, com o ok, remova o worktree pelo Orca
   (`orca worktree rm --worktree id:<id> --json`) em vez de `git worktree remove`, depois de conferir o item 1.
1. Para cada branch mergeada: o worktree ainda existe? Confira `git -C <wt> log origin/develop..HEAD` e
   `git -C <wt> status --short`. Vazio e workers encerrados → remover pelo Orca e apagar somente a branch integrada, exceto plugin-harness. **Não vazio → pergunte**
   (pode ser uma sessão do Orca ainda trabalhando). Nunca encadeie a checagem e a remoção no mesmo comando.
2. PR antigo que a fatia substitui (coluna "Parte de" da Trilha): feche com um comentário apontando o novo.
3. Responda ao dono: o que entrou (PR e uma linha cada), o que ficou e por quê, o que foi limpo e o próximo passo da
   Trilha.
