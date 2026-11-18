# Lançar Claude pessoal sob supervisão

O fluxo Claude continua usando .claude/skills e subagentes .claude/agents, com seus modelos
atuais. Leia .harness/operacao.md para reserva conjunta e registro do TPL/líder.

Não usar --agent claude como prova de perfil: a conta padrão pode ser corporativa.
Para um lançamento novo que precisa garantir o perfil pessoal:

1. Consultar `orca skills get orchestration --reference references/low-level-topology.md`.
2. Confirmar `CLAUDE_CONFIG_DIR="$HOME/.claude-personal" claude auth status`, sem consultar
   ~/.claude ou ~/.claude.json. Confirmar que é o login pessoal esperado pelo dono.
3. Preparar brief e tentativa com team.mjs (agent claude na reserva). Não executar argv null.
4. Criar terminal pessoal no worktree atribuído, com o comando explícito:
   `orca terminal create --worktree path:<raiz> --title "<papel> <fatia>"
   --command 'CLAUDE_CONFIG_DIR="$HOME/.claude-personal" claude --model claude-opus-5-5' --json`.
   Para líder usar o modelo pessoal já escolhido para ele (claude-fable-5-2 --effort high).
   Não incluir flags que removam permissões. Não alterar o alias claude-pessoal.
5. Guardar o handle real do terminal. Pela receita da versão instalada, aguardar readiness
   e anexar supervisão: `orca orchestration worker-start --spec-file <specFile>
   --task-title "<papel> <fatia>" --terminal <handle> --worktree path:<raiz> --keep-open --json`.
   Não passar --agent, --model ou --effort ao anexar terminal existente.
6. Registrar Task/Dispatch/Run retornados. Não repetir após resposta ambígua; usar recuperação Orca.

Isso inicia uma sessão nova autorizada, sem mudar a conta global nem reenviar uma tarefa
para uma sessão já existente. Para corrigir um worker conhecido, usar send ao dispatch.
O TPL Claude continua lançando DEVs/QA nativos; não substituir por workers Codex sem pedido.
Antes de sua entrega, o DEV nativo valida o próprio cwd. O hook também aceita o cwd do TPL,
mas resolve somente a branch irmã exata da fatia, nunca a primeira branch -back do repositório.
