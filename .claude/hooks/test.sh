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

# revisão final: buscas recursivas e nomes de várias partes
expect sem-env 2 "$(bash_cmd 'grep -rn DATABASE_URL apps/api')" "grep -r sem --include lê o .env"
expect sem-env 2 "$(bash_cmd 'grep -Rl X .')" "grep -R"
expect sem-env 2 "$(bash_cmd 'grep --recursive X apps')" "grep --recursive"
expect sem-env 0 "$(bash_cmd 'grep -rn X apps --include=*.ts')" "grep -r com --include"
expect sem-env 0 "$(bash_cmd 'grep -n X apps/api/src/main.ts')" "grep num arquivo"
expect sem-env 0 "$(bash_cmd 'git grep -n X')" "git grep (só arquivos versionados)"
expect sem-env 2 "$(bash_cmd 'rg --no-ignore X')" "rg --no-ignore"
expect sem-env 2 "$(bash_cmd 'rg -uu X')" "rg -uu"
expect sem-env 2 "$(bash_cmd 'rg --hidden X')" "rg --hidden"
expect sem-env 0 "$(bash_cmd 'rg -n X apps')" "rg normal respeita o .gitignore"
expect sem-env 2 "$(bash_cmd 'cat apps/web/.env.development.local')" ".env de várias partes"
expect sem-env 2 "$(bash_cmd 'cat apps/api/.env-backup')" ".env-backup"

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

# revisão final: merge-base e push sem nome de branch
expect sem-merge 0 "$(bash_cmd 'git merge-base --is-ancestor origin/feature/a origin/develop' "$DEV")" "merge-base na develop"
expect sem-merge 2 "$(bash_cmd 'git push' "$DEV")" "push sem argumentos estando na develop"
expect sem-merge 2 "$(bash_cmd 'git push origin HEAD' "$DEV")" "push HEAD estando na develop"
expect sem-merge 2 "$(bash_cmd 'git push origin HEAD:refs/heads/main')" "push para refs/heads/main"
expect sem-merge 2 "$(bash_cmd 'git push origin +develop')" "push forçado +develop"
expect sem-merge 0 "$(bash_cmd 'git push' "$FEAT")" "push sem argumentos na feature"

# --- commit-sem-ia
expect commit-sem-ia 2 "$(bash_cmd 'git commit -m "feat: x

Co-Authored-By: Claude <noreply@anthropic.com>"')" "commit com Co-Authored-By"
expect commit-sem-ia 2 "$(bash_cmd 'git commit -m "feat: x" -m "🤖 Generated with Claude Code"')" "commit com Generated with"
expect commit-sem-ia 0 "$(bash_cmd 'git commit -m "feat(shared): contrato de x"')" "commit limpo"

# expect_out <hook> <saída esperada> <json> [descrição]
expect_out() {
  got=$(printf '%s' "$3" | "$HOOKS/$1.sh" 2>&1)
  if [ "$got" = "$2" ]; then
    echo "ok      $1: ${4:-$3}"
  else
    echo "FALHOU  $1: ${4:-$3} (esperado '$2', veio '$got')"
    falhas=$((falhas + 1))
  fi
}

# --- prettier (formata .ts; respeita o .prettierignore do repo do arquivo)
FMT=$(repo_on feature/fmt)
echo '*.md' >"$FMT/.prettierignore"
printf 'const a   =  1\n' >"$FMT/x.ts"
printf '# t\n\n\n\nfim\n' >"$FMT/y.md"
cp "$FMT/y.md" "$TMP/y.md.antes"
export CLAUDE_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$HOOKS/../.." && pwd)}"
expect prettier 0 "$(tool Write file_path "$FMT/x.ts")" "formata .ts"
if [ "$(cat "$FMT/x.ts")" = "const a = 1;" ]; then echo "ok      prettier: x.ts formatado"; else
  echo "FALHOU  prettier: x.ts não foi formatado: $(cat "$FMT/x.ts")"
  falhas=$((falhas + 1))
fi
expect prettier 0 "$(tool Write file_path "$FMT/y.md")" "md ignorado"
if cmp -s "$FMT/y.md" "$TMP/y.md.antes"; then echo "ok      prettier: y.md intacto"; else
  echo "FALHOU  prettier: y.md mudou"
  falhas=$((falhas + 1))
fi

# --- status line
STATUS=$(repo_on feature/status)
expect_out statusline "feature/status" "{\"workspace\":{\"current_dir\":\"$STATUS\"}}" "só a branch"
mkdir -p "$STATUS/.claude" && echo "Implement" >"$STATUS/.claude/etapa.local"
expect_out statusline "feature/status · Implement" "{\"workspace\":{\"current_dir\":\"$STATUS\"}}" "branch e etapa"
expect_out statusline "" "{\"workspace\":{\"current_dir\":\"$TMP\"}}" "fora de repo git: vazio"

# --- notificação (NOTIFICA_DRY imprime o script em vez de chamar o osascript)
export NOTIFICA_DRY=1
expect_out notifica "display notification \"Claude precisa de permissão\" with title \"fut-stats · montar-times\" sound name \"Glass\"" \
  '{"hook_event_name":"Notification","message":"Claude precisa de permissão","cwd":"/x/montar-times"}' "Notification com mensagem"
expect_out notifica "display notification \"Esperando você\" with title \"fut-stats · montar-times\" sound name \"Glass\"" \
  '{"hook_event_name":"Stop","cwd":"/x/montar-times"}' "Stop sem mensagem"
expect_out notifica "display notification \"diz 'oi'\" with title \"fut-stats · x\" sound name \"Glass\"" \
  '{"message":"diz \"oi\"","cwd":"/x"}' "aspas na mensagem não quebram o script"
unset NOTIFICA_DRY

# --- dev-termina-verde (DEV_CHECK_CMD troca a checagem real por um comando de teste)
# dev_case <descrição> <esperado: vazio ou trecho da saída> <lado> <comando>
dev_case() {
  got=$(printf '%s' "$STOP" | TMPDIR="$TMP" DEV_CHECK_CMD="$4" "$HOOKS/dev-termina-verde.sh" "$3" 2>&1)
  case "$2:$got" in
    "vazio:") ok=1 ;;
    vazio:*) ok=0 ;;
    *) case $got in *"$2"*) ok=1 ;; *) ok=0 ;; esac ;;
  esac
  if [ "$ok" = 1 ]; then echo "ok      dev-termina-verde: $1"; else
    echo "FALHOU  dev-termina-verde: $1 (esperado '$2', veio '$got')"
    falhas=$((falhas + 1))
  fi
}
TPL=$(repo_on feature/z)
git -C "$TPL" commit -q --allow-empty -m init
git -C "$TPL" worktree add -q -b feature/z-back "$TMP/wt-back"
STOP=$(jq -nc --arg cwd "$TPL" '{hook_event_name: "SubagentStop", session_id: "s1", agent_id: "a1", cwd: $cwd}')

dev_case "verde termina" vazio back true
dev_case "vermelho bloqueia" '"decision": "block"' back false
dev_case "2ª vez vermelho" "(2/3)" back false
dev_case "3ª vez vermelho" "(3/3)" back false
dev_case "4ª vez vermelho libera (sem loop infinito)" vazio back false
dev_case "depois de liberar, recomeça" "(1/3)" back false
dev_case "verde no meio" vazio back true
dev_case "verde zera o contador" "(1/3)" back false
dev_case "motivo traz a saída do comando" "saida-do-check" back 'echo saida-do-check; false'
dev_case "roda no worktree -back, não no cwd do TPL" vazio back 'test "$(basename "$PWD")" = wt-back'
dev_case "sem worktree -front, roda no cwd" vazio front "test \"\$(pwd -P)\" = \"$(cd "$TPL" && pwd -P)\""

# --- configuração dos agentes (revisão final)
AGENTS_DIR="$HOOKS/../agents"
for a in dev-back dev-front; do
  # O check real (lint + typecheck + jest com Postgres) passa do timeout padrão de hook.
  if grep -Eq '^[[:space:]]+timeout: (6[0-9]{2}|[7-9][0-9]{2}|[0-9]{4,})$' "$AGENTS_DIR/$a.md"; then
    echo "ok      $a: hook com timeout >= 600s"
  else
    echo "FALHOU  $a: hook sem timeout >= 600s" && falhas=$((falhas + 1))
  fi
done
# Depois de um fix(shared) legítimo, o diff contra o SHA do contrato não vem vazio: o QA olha os commits do front.
if grep -q 'git log feature/<fatia>-back..HEAD -- packages/shared' "$AGENTS_DIR/qa.md"; then
  echo "ok      qa: confere o shared pelos commits do front"
else
  echo "FALHOU  qa: checagem do shared ainda pelo diff contra o SHA do contrato" && falhas=$((falhas + 1))
fi

# --- falha aberta
for h in front-sem-shared sem-env sem-merge commit-sem-ia prettier statusline notifica; do
  expect "$h" 0 "não é json" "entrada inválida libera"
done

echo
if [ "$falhas" -gt 0 ]; then echo "$falhas caso(s) falharam"; exit 1; fi
echo "tudo ok"
