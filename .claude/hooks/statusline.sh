#!/bin/sh
# Status line: "<branch> · <etapa>". A etapa vem de .claude/etapa.local, que o TPL atualiza.
. "$(dirname "$0")/lib.sh"

dir=$(field .workspace.current_dir)
dir=${dir:-$cwd}
root=$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null) || exit 0

out=$(git -C "$dir" branch --show-current)
etapa=$(head -n 1 "$root/.claude/etapa.local" 2>/dev/null)
[ -n "$etapa" ] && out="$out · $etapa"
echo "$out"
