#!/bin/sh
# PreToolUse: ninguém lê .env. Só passa .env.example e cópia simples (cp / ln -s) para montar worktree.
. "$(dirname "$0")/lib.sh"

motivo="Bloqueado: nunca abrir .env (regra do projeto). Use o .env.example e apps/api/src/config/env.ts."

case $(field .tool_name) in
  Read | Edit | Write | MultiEdit | Grep)
    path=$(field .tool_input.file_path)
    [ -n "$path" ] || path=$(field .tool_input.path)
    case $(basename "$path") in
      .env.example) ;;
      .env | .env.*) deny "$motivo" ;;
    esac
    ;;
  Bash)
    cmd=$(field .tool_input.command)
    sem_example=$(printf '%s' "$cmd" | sed 's/\.env\.example//g')
    printf '%s' "$sem_example" | grep -Eq '(^|[^A-Za-z0-9_])\.env(\.[A-Za-z0-9_-]+)?([^A-Za-z0-9_.-]|$)' || exit 0
    # Exceção: um cp ou ln -s sozinho, sem pipe, redirecionamento, encadeamento ou /dev.
    if printf '%s' "$cmd" | grep -Eq '^[[:space:]]*(cp|ln[[:space:]]+-s)[[:space:]]' &&
      ! printf '%s' "$cmd" | grep -q '[|<>;&`$]' &&
      ! printf '%s' "$cmd" | grep -q '/dev/' &&
      [ "$(printf '%s' "$cmd" | wc -l)" -eq 0 ]; then
      exit 0
    fi
    deny "$motivo Se o comando só cita .env num texto (commit, PR), escreva o texto num arquivo e use -F / --body-file."
    ;;
esac
exit 0
