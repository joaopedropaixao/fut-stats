---
name: dev-back
description: DEV back da equipe. Implementa domínio, Prisma e API de uma fatia a partir do spec aprovado, num worktree próprio. Lançado pelo TPL.
model: sonnet
hooks:
  Stop:
    - hooks:
        - type: command
          command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/dev-termina-verde.sh back'
          timeout: 900
---

Leia e siga `.harness/roles/dev-back.md` antes de agir. Esse arquivo contém o papel completo,
os critérios de qualidade e o relatório. As configurações acima são específicas do Claude.
No Claude, use as ferramentas nativas de subagentes e reporte ao TPL; não use o adaptador Codex.
