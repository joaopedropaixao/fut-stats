#!/bin/sh
# Rede Git pessoal sem alterar conta ativa ou persistir credenciais.
# Push sempre publica só a própria feature; não contorna a guarda do harness.
set -eu
operation=${1:-}
case $operation in fetch|pull|push) ;; *) echo "Use fetch, pull ou push." >&2; exit 2 ;; esac
if [ "$operation" = push ]; then
  branch=$(git branch --show-current)
  case $branch in feature/*) ;; *) echo "Push só da própria feature; develop/main entram por PR." >&2; exit 2 ;; esac
  shift
  remote=0 target=0
  for arg in "$@"; do
    case $arg in
      -u|--set-upstream|--force-with-lease|--force-with-lease=*) ;;
      origin) remote=$((remote + 1)) ;;
      "$branch"|"refs/heads/$branch"|"HEAD:$branch"|"HEAD:refs/heads/$branch")
        [ "$remote" -eq 1 ] || { echo "Informe origin antes da branch." >&2; exit 2; }
        target=$((target + 1)) ;;
      *) echo "Push não permitido: use origin e a própria feature, sem --all/--mirror/--force." >&2; exit 2 ;;
    esac
  done
  [ "$remote" -le 1 ] && [ "$target" -le 1 ] || { echo "Destino de push ambíguo." >&2; exit 2; }
  [ "$remote" -eq 1 ] || set -- "$@" origin
  [ "$target" -eq 1 ] || set -- "$@" "HEAD:refs/heads/$branch"
  set -- push "$@"
fi
if [ "$operation" = pull ]; then
  case " $* " in *' --ff-only '*) ;; *) echo "Pull exige --ff-only; rebase é uma etapa explícita." >&2; exit 2 ;; esac
fi
GH_TOKEN=$(gh auth token --user joaopedropaixao)
[ -n "$GH_TOKEN" ] || { echo "Credencial pessoal do GitHub indisponível." >&2; exit 1; }
export GH_TOKEN
exec git -c credential.helper= -c 'credential.helper=!gh auth git-credential' "$@"
