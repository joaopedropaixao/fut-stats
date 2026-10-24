#!/bin/sh
# Testa os hooks da equipe. Uso: sh .claude/hooks/test.sh
# Nenhum caso lê um .env de verdade: os hooks só olham o texto do caminho ou do comando.

HOOKS=$(cd "$(dirname "$0")" && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
falhas=0

# Repo git temporário numa branch, para os hooks que olham a branch.
repo_on() {
  dir="$TMP/repo-$(echo "$1" | tr '/' '-')"
  if [ ! -d "$dir" ]; then
    git init -q "$dir"
    git -C "$dir" checkout -q -b "$1"
    mkdir -p "$dir/packages/shared/src" "$dir/apps/web"
  fi
  echo "$dir"
}

tool() { jq -nc --arg t "$1" --arg k "$2" --arg v "$3" --arg cwd "${4:-$TMP}" \
  '{tool_name: $t, tool_input: {($k): $v}, cwd: $cwd, session_id: "teste"}'; }
bash_cmd() { tool Bash command "$1" "$2"; }

# expect <hook> <exit esperado> <json> [descrição]
expect() {
  printf '%s' "$3" | "$HOOKS/$1.sh" >/dev/null 2>"$TMP/stderr"
  got=$?
  if [ "$got" = "$2" ]; then
    echo "ok      $1: ${4:-$3}"
  else
    echo "FALHOU  $1: ${4:-$3} (esperado $2, veio $got) $(cat "$TMP/stderr")"
    falhas=$((falhas + 1))
  fi
}

# --- front-sem-shared
FRONT=$(repo_on feature/a-front)
BACK=$(repo_on feature/a-back)
expect front-sem-shared 2 "$(tool Write file_path "$FRONT/packages/shared/src/x.ts")" "Write no shared na -front"
expect front-sem-shared 2 "$(tool Edit file_path packages/shared/src/x.ts "$FRONT")" "caminho relativo no shared na -front"
expect front-sem-shared 0 "$(tool Write file_path "$BACK/packages/shared/src/x.ts")" "Write no shared na -back"
expect front-sem-shared 0 "$(tool Write file_path "$FRONT/apps/web/x.ts")" "Write no web na -front"
expect front-sem-shared 2 "$(tool Write file_path "$FRONT/packages/shared/src/novo/y.ts" "$BACK")" "arquivo em outro worktree: vale a branch do arquivo"

# --- sem-env
expect sem-env 2 "$(tool Read file_path apps/api/.env)" "Read .env"
expect sem-env 2 "$(tool Read file_path apps/api/.env.local)" "Read .env.local"
expect sem-env 0 "$(tool Read file_path apps/api/.env.example)" "Read .env.example"
expect sem-env 0 "$(tool Read file_path apps/api/src/config/env.ts)" "Read env.ts"
expect sem-env 2 "$(tool Grep path apps/api/.env)" "Grep no .env"
expect sem-env 2 "$(bash_cmd 'cat apps/api/.env')" "cat .env"
expect sem-env 2 "$(bash_cmd 'grep X .env | head')" "grep .env com pipe"
expect sem-env 2 "$(bash_cmd 'source apps/api/.env')" "source .env"
expect sem-env 0 "$(bash_cmd 'echo $DATABASE_URL')" "echo de variável"
expect sem-env 0 "$(bash_cmd 'node -e "console.log(process.env.X)"')" "process.env"
expect sem-env 0 "$(bash_cmd 'cat apps/api/.env.example')" "cat .env.example"
expect sem-env 0 "$(bash_cmd 'cp ../fut-stats/apps/api/.env apps/api/.env')" "cp do .env"
expect sem-env 0 "$(bash_cmd 'ln -s ../fut-stats/apps/api/.env apps/api/.env')" "ln -s do .env"
expect sem-env 2 "$(bash_cmd 'cp a/.env b/.env && cat b/.env')" "cp encadeado com cat"
expect sem-env 2 "$(bash_cmd 'cp a/.env /dev/stdout')" "cp para a saída"
expect sem-env 2 "$(bash_cmd 'cp a/.env b/.env; cat b/.env')" "cp seguido de cat"

# --- sem-merge
FEAT=$(repo_on feature/x)
DEV=$(repo_on develop)
expect sem-merge 2 "$(bash_cmd 'gh pr merge 40 --squash')" "gh pr merge"
expect sem-merge 2 "$(bash_cmd 'GH_TOKEN=abc gh pr merge 40')" "gh pr merge com token"
expect sem-merge 0 "$(bash_cmd 'git merge feature/x-back' "$FEAT")" "merge do TPL na feature"
expect sem-merge 2 "$(bash_cmd 'git merge feature/x' "$DEV")" "merge estando na develop"
expect sem-merge 2 "$(bash_cmd 'git push origin develop')" "push para develop"
expect sem-merge 2 "$(bash_cmd 'git push origin HEAD:main')" "push HEAD:main"
expect sem-merge 0 "$(bash_cmd 'git push -u origin feature/x')" "push da feature"
expect sem-merge 0 "$(bash_cmd 'git fetch origin develop && git rebase origin/develop')" "rebase na develop"

# --- commit-sem-ia
expect commit-sem-ia 2 "$(bash_cmd 'git commit -m "feat: x

Co-Authored-By: Claude <noreply@anthropic.com>"')" "commit com Co-Authored-By"
expect commit-sem-ia 2 "$(bash_cmd 'git commit -m "feat: x" -m "🤖 Generated with Claude Code"')" "commit com Generated with"
expect commit-sem-ia 0 "$(bash_cmd 'git commit -m "feat(shared): contrato de x"')" "commit limpo"

# --- falha aberta
for h in front-sem-shared sem-env sem-merge commit-sem-ia; do
  expect "$h" 0 "não é json" "entrada inválida libera"
done

echo
if [ "$falhas" -gt 0 ]; then echo "$falhas caso(s) falharam"; exit 1; fi
echo "tudo ok"
