---
name: mergear
description: Integrar PRs Fut Stats autorizados pelo dono, no checkout principal, com CI verde, checkpoints para equipes Claude e Codex e limpeza segura. Usar quando o dono pedir merge de PRs concretos.
---

# Merge pelo orquestrador Codex

O procedimento de Git/PR é compartilhado: leia .claude/skills/mergear/SKILL.md e execute seu
fluxo, com as adaptações abaixo e .harness/operacao.md. Esse skill de origem contém o procedimento
completo de dependências, rebase, conflitos, CI, merge, quadro e avisos; não depende de modelo Claude.

- Somente checkout principal e PRs concretamente autorizados nesta conversa. Aprovação já
  concedida não exige repetir pergunta; não estendê-la a PR novo.
- Antes de mutação, conferir Git e sessões no Orca. Se outro orquestrador estiver atuando no mesmo
  checkout, coordenar a posse; não fazer operações Git simultâneas ali.
- Rede Git exclusivamente pelo script git-pessoal.sh; gh com GH_TOKEN de joaopedropaixao.
- Conferir HEAD remoto/local, CI e mergeable. Preferir gh pr merge --merge --match-head-commit
  <SHA-verificado>, sem apagar branch de harness. Fazer pull --ff-only pessoal após cada merge.
- Cruzar arquivos com quadro.sh afetados e avisar todas as equipes afetadas, Claude e Codex,
  pelo quadro e dispatch Orca correto. Não enviar ao terminal nem mudar ferramenta de uma equipe.
- Se vários Runs estiverem abertos, usar IDs registrados; seguir a CLI da versão instalada.
  Quadro é fonte de status; o registro team.mjs é identidade/recursos, não veredito de qualidade.
- Cleanup: verificar worker_done e ausência de escrita antes de settle. Confirmar commits
  integrados e Git limpo antes de remover worktrees pelo Orca. Preservar chats mantidos para
  o dono; não remover por tempo sem atividade. Só liberar vaga após parar servidores próprios.
- feature/plugin-harness e seu worktree permanecem, conforme AGENTS.md, para próximas entregas.
- Reportar PRs integrados, pendências e limpeza efetivamente realizada. Não afirmar hooks
  ativados nem tarefa de produto concluída apenas porque o PR de harness foi mergeado.
