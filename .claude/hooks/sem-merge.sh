#!/bin/sh
# PreToolUse: merge na develop/main só pelo PR, e só o orquestrador (checkout principal) faz, com o ok do dono
# (skill mergear). TPL, DEVs e QA rodam em worktrees e continuam bloqueados. Merge entre branches de feature passa.
. "$(dirname "$0")/lib.sh"

[ "$(field .tool_name)" = Bash ] || exit 0
cmd=$(field .tool_input.command)
motivo="Bloqueado: merge e push na develop/main são do orquestrador, com o ok do dono (Portão 2). Abra o PR e avise o dono."

# Checkout principal = orquestrador: o git-dir é o próprio .git, não um .git/worktrees/<nome>.
orquestrador() {
  gd=$(git -C "$1" rev-parse --path-format=absolute --git-dir 2>/dev/null) || return 1
  comum=$(git -C "$1" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || return 1
  [ "$gd" = "$comum" ]
}

if printf '%s' "$cmd" | grep -Eq '(^|[^A-Za-z0-9_-])gh[[:space:]]+pr[[:space:]]+merge'; then
  orquestrador "$cwd" || deny "$motivo"
fi

# merge ou push com a branch atual na develop/main (inclui "git push" sem argumentos). Vale a pasta do
# `git -C <pasta>`, se houver; senão, a da sessão.
if printf '%s' "$cmd" | grep -Eq 'git[[:space:]]+(-C[[:space:]]+[^[:space:]]+[[:space:]]+)?(merge|push)([[:space:]]|$)'; then
  alvo=$(printf '%s' "$cmd" | sed -nE "s/.*git[[:space:]]+-C[[:space:]]+['\"]?([^'\"[:space:];&|]+).*/\1/p" | head -1)
  case $(branch_of "${alvo:-$cwd}") in
    develop | main) deny "$motivo" ;;
  esac
fi

# push que nomeia a develop/main (develop, HEAD:main, +develop, refs/heads/main): ninguém, nem o orquestrador.
printf '%s' "$cmd" | grep -Eq 'git[[:space:]]+([^;&|]*[[:space:]])?push[^;&|]*([[:space:]]|:|\+|/)(develop|main)([[:space:]]|$)' && deny "$motivo"
exit 0
