---
name: lancar-equipe
description: Use na sessão do orquestrador quando o dono disser "lança a equipe para <fatia>" (ou "libera a equipe"). Confere a fatia na Trilha, cria o worktree feature/<fatia> pelo Orca e inicia o TPL como worker supervisionado do Orca, com o kickoff.
---

# Lançar a equipe para uma fatia

Você é o orquestrador: prepara o terreno e inicia o TPL. Quem conduz a fatia é o TPL, um **worker supervisionado do
Orca** no worktree novo (skill `tpl`; fluxo em `docs/specs/2026-10-24-equipe-design.md`). O dono pode acompanhar e
conversar com ele no Orca; as perguntas do TPL chegam a você por `ask`. Você não implementa nada.

O Orca é a ferramenta de worktrees e agentes do dono. Antes do primeiro comando `orca` da sessão, carregue os
guias da versão instalada: `orca skills get orchestration` e `orca skills get orca-cli` (as skills `orchestration`
e `orca-cli`). Não faça polling nem script de espera: o Orca te acorda quando um worker pergunta ou termina.

## Convivência com Codex

Leia `.harness/operacao.md`. Este skill é a entrada Claude. Se o dono escolher Codex, use
`.agents/skills/lancar-equipe/SKILL.md`; não adapte modelos Claude por aproximação.
Reserve sempre pela ferramenta comum, incluindo equipes da outra ferramenta e as legadas.

## Passos
1. `sh .claude/scripts/git-pessoal.sh fetch origin` e leia a Trilha em `origin/develop` (`git show origin/develop:docs/03-roadmap.md`).
2. Ache a fatia pelo nome ou número: modo (Front, Back ou Par), "Parte de" (PR ou branch antiga) e entrega.
   Não achou? Mostre a tabela e pergunte.
3. Confira se a fatia anterior foi entregue (PR mergeado ou item `[x]`). Se não foi, avise que a Trilha é uma
   fatia por vez e pergunte se o dono quer seguir mesmo assim.
4. Confira que não existe worktree nem branch `feature/<fatia>` (`git worktree list`, `git branch -a`). Se existir,
   pergunte antes de qualquer coisa.
5. Crie o worktree pelo Orca, com o nome de branch exato (sem o prefixo do Orca) e a partir da develop:
   `orca worktree create --name <fatia> --no-parent --branch feature/<fatia> --base-branch origin/develop --comment "<entrega>" --json`.
   Guarde o `id` e o caminho reais do resultado. Confira a branch exata; colisão com sufixo exige inspeção.
   Antes de configurar recursos, reserve: `node .harness/team.mjs reserve --team <fatia> --agent claude --worktree <caminho>`.
   Use a vaga retornada e não recalcule a partir só das sessões Claude.
6. No worktree novo, rode `pnpm install` e ligue o `.env` da raiz do checkout principal (é o único; API, Prisma e
   Vite leem da raiz). **Um `ln -s` sozinho, com os caminhos absolutos escritos por extenso** (o hook de `.env` só
   libera assim). Link, não cópia: o dono mantém um arquivo só. Nunca leia o conteúdo:
   - `ln -s <checkout principal>/.env ~/orca/workspaces/fut-stats/<fatia>/.env`
7. **Modo paralelo (opcional).** Use quando a reserva retornar slot 1 ou 2 (pedido de paralelo ou outra equipe já ocupando recursos).
   Slot 0 pula para o passo 8: a equipe usa as portas e o banco do `.env`. Desenho e porquês: `docs/specs/2026-10-30-equipe-paralela.md`.
   1. **Vaga.** Use o slot reservado no passo 5. Zero mantém portas/banco do .env; 1 e 2 são paralelas.
      A reserva é atômica e conjunta entre Claude e Codex; respeite recusas e reconcilie o estado antes de seguir.
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
8. Ponha a fatia no quadro, de dentro do worktree novo:
   `cd ~/orca/workspaces/fut-stats/<fatia> && sh .claude/scripts/quadro.sh set <fatia> Lançada "<Toca em do spec, se houver>"`.
9. Escreva o kickoff num arquivo e prepare a tentativa com `node .harness/team.mjs prepare --team <fatia>
   --role tpl --worktree <caminho> --spec <kickoff.md>`. Lance o Claude pessoal por
   `.harness/claude-workers.md`, anexando o terminal pessoal ao worker supervisionado, mantido aberto.
   Registre Task/Dispatch/Run com team.mjs record. Não use --agent claude como prova de conta pessoal.
   Se falhar, não rode de novo: leia failedStage e a referência recovery-and-cleanup do Orca.
10. Responda ao dono em poucas linhas: a fatia, o worktree, que o TPL já está rodando e que você traz as perguntas
    dele. Depois **termine o turno**: o Orca te acorda.

**Quando o Orca te acordar com mensagem de um TPL:**
- `question` que se responde pelo spec, pelo `CONTEXT.md` ou por decisão já registrada do dono: responda com
  `orca orchestration reply --id <message_id> --body "<resposta>"`.
- Regra de negócio nova, Portão 1 ou Portão 2: leve ao dono, com a sua recomendação, e responda com o que ele
  decidir.
- `worker_done`: confira o PR e o álbum e siga a skill `mergear` quando o dono der o ok.
- `escalation` (o TPL parou sem `worker_done`): veja o motivo, mande `send` para destravar ou conte ao dono.

O kickoff (conteúdo do arquivo):

```
Você é o TPL Claude pessoal da fatia `<fatia>` (#<n> da Trilha). Use .claude/skills/tpl/SKILL.md.
Modo: <Par | Front | Back>
Entrega: <texto da coluna Entrega>
Parte de: <PR #NN / branch / —>
Spec: <docs/specs/<fatia>.md, aprovado em <data> (pule o research) / ainda não existe>
Você é um worker do Orca: perguntas ao dono e os portões vão ao coordenador com `orca orchestration ask`; no fim,
`worker_done` com o link do PR e o álbum.
```

   Em modo paralelo, acrescente ao bloco (o TPL repassa aos DEVs e ao QA, que não precisam de prefixo nenhum):
```
Modo paralelo: vaga <n>. API <PORT>, web <WEB_PORT>, banco fut_stats_<slug>, tudo já no .env.equipe do worktree.
Outras equipes rodando: <fatia> em <caminho do worktree>, ... Antes do Portão 1, leia a seção Banco do spec delas.
```
