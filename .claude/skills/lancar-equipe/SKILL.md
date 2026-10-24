---
name: lancar-equipe
description: Use na sessão do orquestrador quando o dono disser "lança a equipe para <fatia>" (ou "libera a equipe"). Confere a fatia na Trilha, cria o worktree feature/<fatia> e entrega o kickoff para o TPL.
---

# Lançar a equipe para uma fatia

Você é o orquestrador: prepara o terreno e entrega o kickoff. Quem conduz a fatia é o TPL, na sessão que o dono vai
abrir no worktree novo (skill `tpl`; fluxo em `docs/specs/2026-10-24-equipe-design.md`). Você não implementa nada.

## Passos
1. `git fetch origin` e leia a Trilha em `origin/develop` (`git show origin/develop:docs/03-roadmap.md`).
2. Ache a fatia pelo nome ou número: modo (Front, Back ou Par), "Parte de" (PR ou branch antiga) e entrega.
   Não achou? Mostre a tabela e pergunte.
3. Confira se a fatia anterior foi entregue (PR mergeado ou item `[x]`). Se não foi, avise que a Trilha é uma
   fatia por vez e pergunte se o dono quer seguir mesmo assim.
4. Confira que não existe worktree nem branch `feature/<fatia>` (`git worktree list`, `git branch -a`). Se existir,
   pergunte antes de qualquer coisa.
5. Crie o worktree (aparece no Orca):
   `git worktree add ~/orca/workspaces/fut-stats/<fatia> -b feature/<fatia> origin/develop`
6. No worktree novo, rode `pnpm install` e copie os `.env` do checkout principal, **um `cp` por comando, com os
   caminhos absolutos escritos por extenso** (o hook de `.env` só libera assim). Nunca leia o conteúdo:
   - `cp <checkout principal>/apps/api/.env ~/orca/workspaces/fut-stats/<fatia>/apps/api/.env`
   - `cp <checkout principal>/apps/web/.env ~/orca/workspaces/fut-stats/<fatia>/apps/web/.env`
7. Responda ao dono com:
   - onde abrir: worktree `<fatia>` no Orca, sessão nova com Opus;
   - o kickoff, num bloco para copiar:

```
Você é o TPL da fatia `<fatia>` (#<n> da Trilha). Use a skill tpl.
Modo: <Par | Front | Back>
Entrega: <texto da coluna Entrega>
Parte de: <PR #NN / branch / —>
```
