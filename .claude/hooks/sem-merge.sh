#!/bin/sh
# PreToolUse: merge e push na develop/main são do dono (Portão 2). Merge entre branches de feature passa.
. "$(dirname "$0")/lib.sh"

[ "$(field .tool_name)" = Bash ] || exit 0
cmd=$(field .tool_input.command)
motivo="Bloqueado: merge e push na develop/main são do dono (Portão 2). Abra o PR e avise o dono."

printf '%s' "$cmd" | grep -Eq '(^|[^A-Za-z0-9_-])gh[[:space:]]+pr[[:space:]]+merge' && deny "$motivo"

if printf '%s' "$cmd" | grep -Eq 'git[[:space:]]+merge'; then
  case $(branch_of "$cwd") in
    develop | main) deny "$motivo" ;;
  esac
fi

printf '%s' "$cmd" | grep -Eq 'git[[:space:]]+push[^;&|]*([[:space:]]|:)(develop|main)([[:space:]]|$)' && deny "$motivo"
exit 0
