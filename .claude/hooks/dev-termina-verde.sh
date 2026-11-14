#!/bin/sh
# Stop do subagente DEV: só termina com lint, typecheck e test verdes no pacote dele.
# Uso: dev-termina-verde.sh back|front. Bloqueia até 3 vezes seguidas; na 4ª libera e o DEV reporta o que ficou vermelho.
. "$(dirname "$0")/lib.sh"

lado=$1
case $lado in back|front) ;; *) deny "Papel inválido: use back ou front." ;; esac

# Um cwd de DEV já é definitivo. No cwd do TPL, só a branch irmã da mesma fatia.
b=$(git -C "$cwd" branch --show-current)
dir=$cwd
case $b in
  *-back|*-front) ;;
  feature/*)
    par=$(git -C "$cwd" worktree list --porcelain 2>/dev/null | awk -v branch="refs/heads/$b-$lado" '
  /^worktree / { wt = substr($0, 10) }
  /^branch / && substr($0, 8) == branch { print wt; exit }')
    dir=${par:-$cwd} ;;
esac
dir=$(cd "$dir" && pwd -P) || deny "Worktree do DEV indisponível."

if [ -n "$DEV_CHECK_CMD" ]; then
  check=$DEV_CHECK_CMD
elif [ "$lado" = front ]; then
  check="pnpm --filter @fut-stats/web run lint && pnpm --filter @fut-stats/web run typecheck && pnpm --filter @fut-stats/web run test"
else
  pkgs="--filter @fut-stats/domain --filter @fut-stats/shared --filter @fut-stats/api"
  check="pnpm $pkgs run lint && pnpm $pkgs run typecheck && pnpm $pkgs run test"
fi

id=$(field .agent_id)
id=${id:-$(field .session_id)}
key=$(printf '%s\n%s\n%s' "$id" "$lado" "$dir" | git hash-object --stdin)
contador="${TMPDIR:-/tmp}/dev-verde-$key"

if out=$(cd "$dir" && sh -c "$check" 2>&1); then
  rm -f "$contador"
  exit 0
fi

n=$(($(cat "$contador" 2>/dev/null || echo 0) + 1))
if [ "$n" -gt 3 ]; then
  rm -f "$contador"
  exit 0
fi
echo "$n" >"$contador"

reason="Checagem vermelha ($n/3) em $dir: $check
$(printf '%s\n' "$out" | tail -n 40)

Corrija antes de terminar. Se na 3ª tentativa ainda falhar, termine e reporte em Fora o que ficou vermelho."
jq -n --arg r "$reason" '{decision: "block", reason: $r}'
