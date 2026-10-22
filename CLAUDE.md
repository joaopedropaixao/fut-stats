# Fut Stats

App de pelada (times, notas, ranking, feed, Cartola). Contexto completo em `docs/`.

## Convenções
- Idioma: código (nomes, identificadores) em inglês; textos de UI, commits e docs em português.
- Git Flow: `main` (prod), `develop` (staging), `feature/<descricao>`. Nunca commitar direto em `main`/`develop`.
- Tarefas vivem em `docs/03-roadmap.md`; marcar `[x]` no PR que entrega o item.
- Domínio: fut7 semanal, uma partida por rodada (Branco x Preto), formação 1-2-3-1.
- Commits: Conventional Commits (`feat(escopo): ...`).
- Todo dado de domínio pertence a um grupo (`groupId`). Nunca vazar dados entre grupos.
- Lógica de domínio (balanceamento de times, notas, pontuação/preço do Cartola) em funções puras com testes unitários.
- Schemas de validação compartilhados em `packages/shared` (Zod).
- Segredos só em `.env` (nunca commitados); manter `.env.example` atualizado.
- Commits e PRs sem trailers de co-autoria de IA (`Co-Authored-By`, "Generated with...").
- Conta GitHub do repo: **joaopedropaixao** (pessoal). Para comandos `gh`, use
  `GH_TOKEN=$(gh auth token --user joaopedropaixao) gh ...` (a conta ativa do `gh` na máquina é outra).
- PRs sempre com base em `develop` (exceto release/hotfix para `main`).

## Comandos principais
Rodar na raiz (Node 24, pnpm via Corepack). O Turborepo executa em todos os pacotes na ordem certa.
- `pnpm install`: instala dependências de todo o monorepo.
- `pnpm dev` (`turbo watch dev`): sobe API (`:3000`) e web (`:5173`, proxy `/api/*` → API). Mudanças em
  `packages/*` recompilam o pacote e reiniciam as apps sozinhas.
- `pnpm lint` (ESLint + Prettier check), `pnpm typecheck`, `pnpm test`, `pnpm build`.
- `pnpm format`: aplica o Prettier.
- Um pacote só: `pnpm --filter @fut-stats/api test` (ou `web`, `shared`, `domain`).
- Adicionar dependência: `pnpm --filter @fut-stats/web add <pacote>`.
- Testes da API: Jest (Nest 12 é ESM, por isso roda com `--experimental-vm-modules`); `packages/domain`: Vitest.
- `packages/shared` e `packages/domain` são compilados (tsup) para `dist/`; o Turbo builda eles antes de quem depende.
- Rotas da API ficam sob `/api` (`setGlobalPrefix` em `apps/api/src/setup-app.ts`), igual em dev e produção.
- Variáveis de ambiente da API são validadas com Zod em `apps/api/src/config/env.ts`; nova variável entra lá e no `.env.example`.

## Ambiente de desenvolvimento: Orca (stablyai/orca)
- IDE que orquestra vários agentes de CLI (Claude Code, Codex, OpenCode, Pi...) em paralelo, em abas/painéis.
- **Cada agente roda em um git worktree próprio** (cópia isolada do repo, branch própria). Não compartilham working directory.
  Mudanças não commitadas de um worktree não existem nos outros.
- Dá para disparar o mesmo prompt em vários agentes e comparar os diffs.
- Source control embutido (review de diff, commit) e integração com GitHub (PRs, checks por worktree).
- CLI: `orca worktree create` e outros comandos para agentes criarem/controlarem worktrees.

### Regras de paralelização
1. Uma tarefa = um worktree = uma branch = um PR para `develop`.
2. Cada tarefa mexe em pastas diferentes. Arquivos compartilhados (`package.json` da raiz,
   `pnpm-lock.yaml`, `schema.prisma`, configs de CI) têm **um dono por vez**.
3. Antes de abrir o PR: `git fetch && git rebase origin/develop`, rodar lint/typecheck/testes.
4. Dependências entre tarefas ficam explícitas no plano; não comece uma tarefa antes da dependência estar mergeada.

## Design: Paper (paper.design)
- Telas são desenhadas no Paper (canvas baseado em HTML/CSS) via MCP, com o Claude Code fazendo as alterações.
- Nenhuma tela do `apps/web` é implementada antes de ter design aprovado no Paper.
