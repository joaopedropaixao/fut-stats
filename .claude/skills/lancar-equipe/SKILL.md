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
6. No worktree novo, rode `pnpm install` e ligue o `.env` da raiz do checkout principal (é o único; API, Prisma e
   Vite leem da raiz). **Um `ln -s` sozinho, com os caminhos absolutos escritos por extenso** (o hook de `.env` só
   libera assim). Link, não cópia: o dono mantém um arquivo só. Nunca leia o conteúdo:
   - `ln -s <checkout principal>/.env ~/orca/workspaces/fut-stats/<fatia>/.env`
7. **Modo paralelo (opcional).** Só se o dono pediu ("lança em paralelo", "lança também") ou se já há outra equipe
   rodando (`git worktree list`: algum worktree com `feature/<fatia>` ativa). Sem isso, pule para o passo 8: a equipe
   usa as portas e o banco do `.env`. Desenho e porquês: `docs/specs/2026-10-30-equipe-paralela.md`.
   1. **Vaga.** A equipe sem `.env.equipe` ocupa a vaga 0 (API 3000, web 5173, banco do `.env`). Leia o `PORT` do
      `.env.equipe` de cada worktree que tiver um (só tem portas e banco local, pode ler) e pegue a menor vaga `n`
      livre, de 1 a 2: no máximo 3 equipes ao mesmo tempo. Acima disso, avise o dono e pare.
   2. **Arquivo.** Com a ferramenta Write, crie `~/orca/workspaces/fut-stats/<fatia>/.env.equipe` (caminho absoluto):
      ```
      PORT=<3000 + 100·n>
      WEB_PORT=<5173 + 100·n>
      APP_URL=http://localhost:<WEB_PORT>
      API_PROXY_TARGET=http://localhost:<PORT>
      DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fut_stats_<slug>
      DIRECT_URL=postgresql://postgres:postgres@localhost:5432/fut_stats_<slug>
      ```
      `<slug>` = a fatia em minúsculas, o que não for letra ou número vira `_`, até 40 caracteres. A `DIRECT_URL`
      repete a URL de propósito: a migration lê ela antes da `DATABASE_URL`, e a do `.env` levaria a migration da
      equipe para o banco principal. **Nada de segredo neste arquivo.**
   3. **Banco.** No worktree novo, um comando por vez, sem prefixo (o arquivo já vale):
      `pnpm --filter @fut-stats/domain --filter @fut-stats/shared build`, `pnpm --filter @fut-stats/api generate`,
      `pnpm --filter @fut-stats/api db:deploy` (cria o banco se não existir) e `pnpm --filter @fut-stats/api db:seed`.
   4. **Quem mais está rodando.** Anote, para o kickoff, cada equipe em andamento com o caminho do worktree dela.
8. Responda ao dono com:
   - onde abrir: worktree `<fatia>` no Orca, sessão nova com Opus;
   - o kickoff, num bloco para copiar:

```
Você é o TPL da fatia `<fatia>` (#<n> da Trilha). Use a skill tpl.
Modo: <Par | Front | Back>
Entrega: <texto da coluna Entrega>
Parte de: <PR #NN / branch / —>
```

   Em modo paralelo, acrescente ao bloco (o TPL repassa aos DEVs e ao QA, que não precisam de prefixo nenhum):
```
Modo paralelo: vaga <n>. API <PORT>, web <WEB_PORT>, banco fut_stats_<slug>, tudo já no .env.equipe do worktree.
Outras equipes rodando: <fatia> em <caminho do worktree>, ... Antes do Portão 1, leia a seção Banco do spec delas.
```
