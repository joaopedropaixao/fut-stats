---
name: dev-front
description: DEV front da equipe. Implementa a tela de uma fatia a partir do spec aprovado e do contrato, num worktree próprio, validando no Playwright. Lançado pelo TPL.
model: sonnet
hooks:
  Stop:
    - hooks:
        - type: command
          command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/dev-termina-verde.sh front'
          timeout: 600
---

Leia e siga `.harness/roles/dev-front.md` antes de agir. Esse arquivo contém o papel completo,
os critérios de qualidade e o relatório. As configurações acima são específicas do Claude.
No Claude, use as ferramentas nativas de subagentes e reporte ao TPL; não use o adaptador Codex.
