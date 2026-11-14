#!/bin/sh
# Stop: a sessão de um worktree de feature (TPL, líder) não termina com commit sem push. Foi assim que o #49 ficou
# dias em conflito e 5 commits de grupos ficaram presos numa branch local.
# Não vale para o checkout principal nem para as branches -back/-front (locais por desenho).
. "$(dirname "$0")/lib.sh"

[ "$(field .stop_hook_active)" = true ] && exit 0

gd=$(git -C "$cwd" rev-parse --path-format=absolute --git-dir 2>/dev/null) || exit 0
comum=$(git -C "$cwd" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || exit 0
[ "$gd" = "$comum" ] && exit 0

b=$(git -C "$cwd" branch --show-current)
case $b in
  feature/*-back | feature/*-front) exit 0 ;;
  feature/*) ;;
  *) exit 0 ;;
esac

if git -C "$cwd" rev-parse -q --verify "origin/$b" >/dev/null; then
  a=$(git -C "$cwd" rev-list --count "origin/$b..HEAD")
  r=$(git -C "$cwd" rev-list --count "HEAD..origin/$b")
  [ "$a" -eq 0 ] && exit 0
  if [ "$r" -gt 0 ]; then
    como="git push --force-with-lease (houve rebase: o remoto tem $r commits que a branch local reescreveu)"
  else
    como="git push"
  fi
else
  a=$(git -C "$cwd" rev-list --count origin/develop..HEAD 2>/dev/null || echo 0)
  [ "$a" -eq 0 ] && exit 0
  como="git push -u origin $b (a branch nunca foi enviada)"
fi

reason="A branch $b tem $a commits sem push. Antes de parar: $como. Depois, atualize o quadro (.claude/scripts/quadro.sh set ...)."
jq -n --arg r "$reason" '{decision: "block", reason: $r}'
