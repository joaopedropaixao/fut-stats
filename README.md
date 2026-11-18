# ⚽ Fut Stats

App para deixar a pelada mais interativa: **times equilibrados automaticamente,
notas pós-jogo, ranking, resenhas e um Cartola da pelada.**

> 🚧 Em desenvolvimento. Veja o [roadmap](docs/03-roadmap.md).

## Funcionalidades

- **Seletor de times**: sugere times equilibrados por nota, posição e histórico, sem repetir panelinha
- **Notas da rodada**: cada jogador avalia os outros e vota no Craque e no Perna de Pau
- **Ranking**: média, vitórias, gols, assistências, vezes Craque (geral e por posição)
- **Feed**: notícias e resenhas da pelada, com reações e comentários
- **Histórico**: todas as rodadas, placares e notas
- **Cartola**: monte seu time com os jogadores da pelada *(v1.1)*

## Stack

React · Vite · TypeScript · NestJS · Prisma · PostgreSQL · PWA · pnpm/Turborepo

## Como rodar localmente

Pré-requisitos: **Node 24** (veja `.nvmrc`), **pnpm** (via Corepack: `corepack enable`) e **Docker**.

```bash
pnpm install                                # instala tudo (todas as apps e pacotes)
cp .env.example .env                        # variáveis da API e do front (um .env só, na raiz)
docker compose up -d                        # Postgres de dev (5432) e de testes (5433)
pnpm --filter @fut-stats/api db:migrate     # cria as tabelas
pnpm --filter @fut-stats/api db:seed        # dados fictícios (1 grupo, 21 membros, 8 rodadas + a atual)
pnpm dev                                    # sobe API e web juntas
```

O seed recria as rodadas do grupo do seed a cada execução. A rodada atual sai no estado do cenário:
`agendada` (padrão), `times` (times publicados) ou `em-jogo` (com alguns lances), por exemplo
`pnpm --filter @fut-stats/api db:seed -- --cenario=em-jogo`.

- Web: http://localhost:5173 (mostra o status da API)
- API: http://localhost:3000/api/health → `{ "status": "ok" }` (todas as rotas ficam sob `/api`)

Outros comandos (na raiz): `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm format`.
`pnpm test` precisa do Postgres de testes no ar (`docker compose up -d`).

Banco (`pnpm --filter @fut-stats/api <script>`): `db:migrate` (cria migration a partir do
`schema.prisma` e aplica), `db:seed`, `db:reset` (apaga tudo e reaplica), `db:studio` (vê os dados
no navegador), `generate` (regera o client do Prisma).

### Estrutura

```
apps/api              NestJS (porta 3000) + Prisma (apps/api/prisma)
apps/web              React + Vite + Tailwind (porta 5173; /api/* → API)
packages/shared       schemas Zod usados pela API e pela web
packages/domain       regras de domínio puras (Vitest)
packages/eslint-config  config de ESLint compartilhada
```

## Documentação

1. [Visão e escopo](docs/01-visao-e-escopo.md)
2. [Arquitetura e stack](docs/02-arquitetura.md)
3. [Roadmap](docs/03-roadmap.md)
4. [Cartola da pelada](docs/04-cartola.md)
5. [Fluxo de trabalho](docs/05-fluxo-de-trabalho.md)
