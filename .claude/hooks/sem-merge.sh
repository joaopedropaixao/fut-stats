#!/bin/sh
# PreToolUse: merge e push na develop/main são do dono (Portão 2). Merge entre branches de feature passa.
. "$(dirname "$0")/lib.sh"

[ "$(field .tool_name)" = Bash ] || exit 0
cmd=$(field .tool_input.command)
motivo="Bloqueado: merge e push na develop/main são do dono (Portão 2). Abra o PR e avise o dono."

printf '%s' "$cmd" | grep -Eq '(^|[^A-Za-z0-9_-])gh[[:space:]]+pr[[:space:]]+merge' && deny "$motivo"

# merge ou push estando na develop/main (inclui "git push" sem argumentos).
if printf '%s' "$cmd" | grep -Eq 'git[[:space:]]+(merge|push)([[:space:]]|$)'; then
  case $(branch_of "$cwd") in
    develop | main) deny "$motivo" ;;
  esac
fi

# push que nomeia a develop/main: develop, HEAD:main, +develop, refs/heads/main.
printf '%s' "$cmd" | grep -Eq 'git[[:space:]]+push[^;&|]*([[:space:]]|:|\+|/)(develop|main)([[:space:]]|$)' && deny "$motivo"
exit 0
