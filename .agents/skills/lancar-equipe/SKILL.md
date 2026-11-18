---
name: lancar-equipe
description: Lançar uma equipe Fut Stats a pedido do dono, com TPL supervisionado pelo Orca, perfil pessoal e escolha explícita de Claude ou Codex. Usar para lançar uma fatia da Trilha, não para implementar o harness.
---

# Lançar equipe pelo Codex

Você coordena; o TPL entrega a fatia. Leia .harness/operacao.md e os guias instalados do Orca.
Se o dono escolheu Claude, preparar reserva e seguir .harness/claude-workers.md com o kickoff
Claude (.claude/skills/lancar-equipe/SKILL.md); não executar o comando nativo --agent claude
sem garantir o perfil pessoal. Sem escolha de ferramenta, usar Codex nesta sessão.

## Preparar

1. Fetch pessoal. Ler a Trilha atual: `git show origin/develop:docs/03-roadmap.md`.
   Identificar fatia, modo Front/Back/Par, entrega, Parte de e dependências. Ambiguidade vai ao dono.
   Se a anterior ainda não foi entregue, pedir decisão de seguir ou esperar, salvo autorização já dada.
2. Conferir sessões, workers, quadro, branches e worktrees. Uma tarefa existente não é uma nova
   autorização para retomá-la. Não assumir lider-v1 nem outra fatia pausada por limite de uso.
3. Criar worktree feature/<fatia> na origin/develop pelo Orca, sem iniciar agente. Conferir branch
   exata e guardar ID/path. Reservar vaga conjunta por team.mjs conforme .harness/operacao.md.
4. Preparar pnpm install e link do .env, sem ler conteúdo. Se reserva usar vaga 1/2, escrever
   .env.equipe com as portas e banco retornados; DATABASE_URL e DIRECT_URL devem ser idênticas.
   Rodar, no worktree: `pnpm --filter @fut-stats/domain --filter @fut-stats/shared build`,
   `pnpm --filter @fut-stats/api generate`, `pnpm --filter @fut-stats/api db:deploy` e
   `pnpm --filter @fut-stats/api db:seed`. Vaga 0 preserva banco/portas do dono e suas aprovações.
5. Conferir que a base contém este harness e que a sessão poderá revisar os hooks. Se ainda
   faltar merge do harness, não copiar arquivos soltos para fatia de produto nem desativar hooks.
6. Registrar `sh .claude/scripts/quadro.sh set <fatia> Lançada "<Toca em>"` no worktree.

## Kickoff e execução

Criar brief fora do Git com:

```text
Você é o TPL da fatia <fatia> (#<n> da Trilha).
Modo: Front|Back|Par. Entrega: <entrega>.
Spec: <caminho, status e data de aprovação, ou ainda não existe>.
Parte de: <PR/branch antiga ou nenhuma>.
Toca em e dependências: <caminhos/fatias>.
Outras equipes: <fatia, ferramenta, worktree, models compartilhados>.
Portas e banco: <valores da reserva>. Não atuar nos recursos de outra equipe.
Use .agents/skills/tpl/SKILL.md e .harness/codex-workers.md.
Perguntas e portões vão ao coordenador via ask; entrega via worker_done com PR e álbum.
```

Executar prepare com role tpl, chamar uma única vez o worker-start fornecido e registrar o
recibo (Task/Dispatch/Run). Modelo gpt-6-luna, esforço medium. Sem escalada automática.
Depois, informar fatia/worktree e **terminar o turno**. Orca acorda você.

## Ao receber retorno

- Question respondível pelo spec/CONTEXT/conversa: reply. Decisão nova de produto ou portão:
  levar ao dono, sem pedir novamente uma aprovação já concedida.
- Worker_done: verificar PR, tabela QA e álbum; não equivale a autorização de merge.
- Escalation/limite/resultado ambíguo: seguir recuperação documentada, não duplicar worker nem trocar agente.
- Pedido de correção: send ao dispatch existente, não novo lançamento da mesma fatia.
- Merge: seguir .agents/skills/mergear/SKILL.md quando o dono autorizar o PR concreto.
