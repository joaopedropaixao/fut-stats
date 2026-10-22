# Fut Stats: regras para agentes

App de pelada (times, notas, ranking, feed, Cartola). Contexto de produto em `docs/`;
regra de negócio vem de lá. **Se a regra estiver ambígua ou em aberto, pergunte; não invente.**

## Convenções
- Código em inglês; UI, commits, PRs e docs em português.
- Git Flow: `feature/<descricao>` → PR para `develop` (`main` só via release/hotfix). Conventional Commits.
  Sem trailers de IA (`Co-Authored-By`, "Generated with...") em commits e PRs.
- GitHub só pela conta pessoal: `GH_TOKEN=$(gh auth token --user joaopedropaixao) gh ...`.
- Uma tarefa = um worktree = uma branch = um PR. Arquivos compartilhados (`package.json` da raiz,
  `pnpm-lock.yaml`, `schema.prisma`, CI) têm um dono por vez. Antes do PR: `git fetch && git rebase origin/develop`.
- Pronto = `pnpm lint && pnpm typecheck && pnpm test && pnpm build` passando na raiz + item marcado em `docs/03-roadmap.md`.
- Dependência nova: justificar no PR. Segredos só em `.env`; manter `.env.example` atualizado.
- Comandos: `pnpm dev` sobe API (`:3000`) e web (`:5173`); um pacote só com `pnpm --filter @fut-stats/<pacote> <script>`.

## Arquitetura
- `packages/domain`: regras de negócio em funções puras, zero dependências, parâmetros ajustáveis como config
  com default. Tipos base em `src/core/` (posição, time, formação 1-2-3-1, nota, escalação): reusar, não redefinir.
- `packages/shared`: contratos Zod (derivados do domain). Validar na borda (rota e formulário); dentro, confiar nos tipos.
- `apps/api` (NestJS, rotas sob `/api`): um módulo por feature em `src/<feature>/`.
  - Controller: HTTP + validação com schema do shared. Nada de regra.
  - Service: orquestra (autoriza, carrega, chama o domain, persiste). Usa `PrismaService` injetado; sem camada de repository.
  - Injeção sempre via providers do módulo (construtor); nunca `new` de service.
  - Variável de ambiente nova: schema em `src/config/env.ts` + `.env.example`.
- **Multi-grupo:** todo dado de domínio pertence a um `groupId`. Toda query filtra por ele e o service confere
  a participação/papel do usuário no grupo antes. Nunca confiar em `groupId` vindo do cliente sem checar.
- `apps/web`: nenhuma tela sem design aprovado no Paper. Sem regra de negócio no front.

## Testes
| O quê | Como |
|---|---|
| Regra de negócio (`domain`) | Unitário (Vitest), testes primeiro, casos de borda. Obrigatório. |
| Rota + service + banco (`api`) | Integração: supertest na app real + Postgres de teste (Docker local, service container no CI). Não mockar Prisma; não testar controller ou query isolados. |
| Tela (`web`) | Ao terminar, validar no navegador com o MCP do Playwright: fluxo principal funciona e console sem erros. |
| Bug corrigido | Vem com um teste que reproduz. |
