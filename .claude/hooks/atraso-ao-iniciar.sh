#!/bin/sh
# SessionStart: no checkout principal (orquestrador), mostra o quadro e os atrasos já na primeira mensagem.
# Nos worktrees de equipe não faz nada.
. "$(dirname "$0")/lib.sh"

gd=$(git -C "$cwd" rev-parse --path-format=absolute --git-dir 2>/dev/null) || exit 0
comum=$(git -C "$cwd" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || exit 0
[ "$gd" = "$comum" ] || exit 0

scripts=$(cd "$(dirname "$0")/../scripts" && pwd)
echo "Quadro da v1:"
(cd "$cwd" && sh "$scripts/quadro.sh" show) 2>/dev/null
echo
(cd "$cwd" && sh "$scripts/checar-atraso.sh") 2>/dev/null
exit 0
