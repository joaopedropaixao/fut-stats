# Equipe em paralelo: portas, banco e migrations

**Status:** aprovado pelo dono em 2026-10-25 (modo paralelo com `.env.equipe`, migrations por checagem no Portão 1 e
refazer no rebase). Complementa `2026-10-24-equipe-design.md`.

## Problema
As skills `lancar-equipe` e `tpl` foram feitas para uma equipe por vez. Duas equipes rodando juntas brigam por:
- **Portas:** as duas sobem a API na 3000 e a web na 5173.
- **Banco de dev:** o seed apaga e recria as rodadas do grupo, então o cenário de uma equipe apaga o da outra.
- **`schema.prisma`:** migrations que se cruzam.

Na rodada de `seletor-de-times` + `placar-e-lances` isso foi resolvido à mão, com um prefixo de variáveis repetido em
todo comando. Um esquecimento derruba tudo.

## Princípios
- **Opcional:** só vale se o dono pedir "lança em paralelo". Sem o pedido, nada muda: sem `.env.equipe`, vale só o `.env`.
- **Independência:** cada equipe tem portas, banco de dev e banco de teste próprios. Testes, criação de usuário e
  fluxos ponta a ponta ficam locais, no banco da equipe.
- **Sem depender de memória do agente:** a configuração vive num arquivo, não num prefixo de comando.

## 1. `.env.equipe` por worktree
Arquivo na raiz do worktree (fora do git, o `.gitignore` já cobre `.env.*`), lido **antes** do `.env` da raiz:

```
PORT=<3000 + 100·n>
WEB_PORT=<5173 + 100·n>
APP_URL=http://localhost:<WEB_PORT>
API_PROXY_TARGET=http://localhost:<PORT>
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fut_stats_<fatia>
DIRECT_URL=<o mesmo valor da DATABASE_URL>
```

- **Vaga n:** a equipe sem `.env.equipe` ocupa a vaga 0 (3000, 5173, banco `fut_stats` do `.env`). Uma nova equipe
  em paralelo ocupa a menor vaga livre, de 1 a 2: **no máximo 3 equipes ao mesmo tempo**.
- **`<fatia>` no banco:** minúsculas, o que não for letra ou número vira `_`, no máximo 40 caracteres.
- **`DIRECT_URL`:** a migration lê `DIRECT_URL` antes de `DATABASE_URL`; se o `.env` do dono tiver uma, ela
  levaria as migrations da equipe para o banco principal. Por isso o arquivo repete a URL nas duas.
- **Quem lê** (PR de código): a API (`envFilePaths`), o Prisma (`prisma.config.ts`) e o Vite (`WEB_PORT`, com
  `strictPort`). `pnpm dev`, `db:deploy` e `db:seed` já caem na vaga certa, sem prefixo.
- **Quem cria:** a `lancar-equipe`, ao criar o worktree em modo paralelo. A `tpl` liga o arquivo nos worktrees
  `-back` e `-front`, que dividem a vaga.
- **Banco:** o `prisma migrate deploy` cria o banco se ele não existir. Se já existir de uma rodada anterior, é
  reaproveitado (migrate e seed são idempotentes; o seed recria as rodadas do grupo).
- **Banco de teste:** já é um por worktree (`fut_stats_<pasta>_test`).
- **Guarda `sem-env`:** libera `.env.equipe` como já libera `.env.example`, porque ele só tem portas e o banco local
  do Docker (`postgres:postgres`, o mesmo do `.env.example`). Segredo nunca vai nele. Um nome maior
  (`.env.equipe.bak`) e o `.env` junto no mesmo comando continuam bloqueados.

## 2. Migrations: sem agentes conversando
Conversa ao vivo entre equipes é frágil e faz uma esperar a outra. Com bancos separados, uma migration de uma
equipe não quebra a outra enquanto elas trabalham. O conflito só aparece no planejamento e no merge.

**A. Checar no Portão 1.** O TPL de uma equipe nova lê a seção **Banco** do spec de cada equipe que já está rodando
(`<worktree dela>/docs/specs/<fatia>.md`) antes de pedir o ok do dono. Se as duas mexem no mesmo model, o dono
decide ali: seguir, adiar ou serializar. A `lancar-equipe` já avisa o TPL de quais equipes estão rodando.

**B. Refazer a migration no rebase.** Quem entra por segundo faz o rebase, apaga a pasta da própria migration e a
gera de novo. Ela sai com data nova, depois da que entrou, e o Prisma acusa se as duas brigarem. É um passo da
entrega do TPL. No banco da equipe (modo paralelo) ele pode rodar `db:reset` e `db:seed`; fora do modo paralelo o
banco é o do dono, então pergunta antes.

**Plano de reserva:** só uma equipe mexe em `schema.prisma` por vez (como nesta rodada). Só entra se as duas
fatias precisarem mexer no mesmo model.

## Entregas
1. **Código** (PR #51): `envFilePaths`, `prisma.config.ts`, `WEB_PORT` no Vite e o `.env.example`.
2. **Harness:** guarda `sem-env` com testes, opção "em paralelo" na `lancar-equipe`, a `tpl` ligando o arquivo e
   checando o Banco no Portão 1, o passo de refazer a migration, o campo de models no spec e este documento.

## Fora do escopo
- Banco de dev por worktree quando **não** estiver em modo paralelo.
- Comunicação entre agentes em tempo real.
- Mais de uma instância do Docker.
