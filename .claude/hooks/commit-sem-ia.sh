#!/bin/sh
# PreToolUse: commit sem trailer de IA (Co-Authored-By, "Generated with").
. "$(dirname "$0")/lib.sh"

[ "$(field .tool_name)" = Bash ] || exit 0
cmd=$(field .tool_input.command)

printf '%s' "$cmd" | grep -Eq 'git[[:space:]]+commit' || exit 0
printf '%s' "$cmd" | grep -Eiq 'co-authored-by|generated with' &&
  deny "Bloqueado: commit sem trailer de IA (Co-Authored-By, Generated with). Tire a linha e refaça o commit."
exit 0
