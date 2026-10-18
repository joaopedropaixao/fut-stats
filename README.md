# ⚽ Fut Stats

App para deixar a pelada mais interativa: **times equilibrados automaticamente,
notas pós-jogo, ranking, resenhas e um Cartola da pelada.**

> 🚧 Em desenvolvimento. Veja o [roadmap](docs/03-roadmap.md).

## Funcionalidades

- **Seletor de times**: sugere times equilibrados por nota, posição e histórico, sem repetir panelinha
- **Notas da rodada**: cada jogador avalia os outros e vota no Craque e no Bola Murcha
- **Ranking**: média, vitórias, gols, assistências, MVPs (geral e por posição)
- **Feed**: notícias e resenhas da pelada, com reações e comentários
- **Histórico**: todas as rodadas, placares e notas
- **Cartola**: monte seu time com os jogadores da pelada *(v1.1)*

## Stack

React · Vite · TypeScript · NestJS · Prisma · PostgreSQL · PWA · pnpm/Turborepo

## Como rodar localmente

Pré-requisitos: **Node 24** (veja `.nvmrc`) e **pnpm** (via Corepack: `corepack enable`).

```bash
pnpm install                                # instala tudo (todas as apps e pacotes)
cp apps/api/.env.example apps/api/.env      # variáveis da API
cp apps/web/.env.example apps/web/.env      # variáveis do front
pnpm dev                                    # sobe API e web juntas
```

- Web: http://localhost:5173 (mostra o status da API)
- API: http://localhost:3000/health → `{ "status": "ok" }`

Outros comandos (na raiz): `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm format`.

### Estrutura

```
apps/api              NestJS (porta 3000)
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
