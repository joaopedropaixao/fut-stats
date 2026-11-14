#!/bin/sh
# Detector de atraso: o que está ficando velho ou sem push. Só mostra alertas; sem alerta, uma linha "tudo em dia".
# Rodado pelo orquestrador a cada conversa (hook de início de sessão) e antes de cada merge (skill mergear).
#
# Para cada worktree de feature: atrás da develop, commits sem push, local divergente do remoto, mudança sem
# commit e linha parada no quadro. Para os specs na develop: base velha com dependência mergeada depois.
# CHECAR_SEM_FETCH=1 pula o git fetch (testes). QUADRO_PARADO_S muda o limite de "parado" (padrão 2 h).

set -u
cd "${1:-.}" || exit 1
[ "${CHECAR_SEM_FETCH:-}" = 1 ] || git fetch -q --prune origin 2>/dev/null

SEP=$(printf '\t')
MAIN=$(git worktree list --porcelain | awk '/^worktree / { print substr($0, 10); exit }')
QUADRO="$MAIN/.claude/quadro-v1.local.tsv"
LIMITE=${QUADRO_PARADO_S:-7200}
AGORA=$(date +%s)

git worktree list --porcelain | awk '
  /^worktree / { wt = substr($0, 10) }
  /^branch refs\/heads\// { print wt "\t" substr($0, 19) }' |
  while IFS="$SEP" read -r wt b; do
    [ "$wt" = "$MAIN" ] && continue
    case $b in feature/*) ;; *) continue ;; esac
    nome=${b#feature/}

    atras=$(git -C "$wt" rev-list --count HEAD..origin/develop 2>/dev/null || echo 0)
    [ "$atras" -gt 0 ] && echo "⚠ $nome: $atras commits atrás da develop (rebase no próximo checkpoint)"

    case $b in
      *-back | *-front) ;; # branches do par são locais por desenho: o TPL junta e dá push da feature/<fatia>
      *)
        if git -C "$wt" rev-parse -q --verify "origin/$b" >/dev/null; then
          a=$(git -C "$wt" rev-list --count "origin/$b..HEAD")
          r=$(git -C "$wt" rev-list --count "HEAD..origin/$b")
          if [ "$a" -gt 0 ] && [ "$r" -gt 0 ]; then
            echo "⚠ $nome: local e remoto divergiram ($a só local, $r só no remoto); rebase sem push?"
          elif [ "$a" -gt 0 ]; then
            echo "⚠ $nome: $a commits sem push"
          fi
        else
          a=$(git -C "$wt" rev-list --count origin/develop..HEAD 2>/dev/null || echo 0)
          [ "$a" -gt 0 ] && echo "⚠ $nome: $a commits e a branch nunca foi enviada"
        fi
        ;;
    esac

    sujo=$(git -C "$wt" status --porcelain --untracked-files=no | wc -l | tr -d ' ')
    [ "$sujo" -gt 0 ] && echo "⚠ $nome: $sujo arquivos alterados sem commit"

    if [ -f "$QUADRO" ]; then
      ts=$(awk -F "$SEP" -v f="$nome" '$1 == f { print $8 }' "$QUADRO")
      if [ -n "$ts" ] && [ $((AGORA - ts)) -gt "$LIMITE" ]; then
        echo "⚠ $nome: quadro parado há $(((AGORA - ts) / 3600)) h"
      fi
    fi
  done >"${TMPDIR:-/tmp}/checar-atraso.$$"

# Specs na develop: "Base: develop @<sha>" e "Depende de: a, b". Dependência mergeada depois da base → rever.
for spec in $(git ls-tree --name-only origin/develop docs/specs/ 2>/dev/null | grep '\.md$'); do
  texto=$(git show "origin/develop:$spec" 2>/dev/null) || continue
  printf '%s\n' "$texto" | grep -q 'aprovado' || continue
  base=$(printf '%s\n' "$texto" | sed -nE 's/.*Base\*?\*?[^@]*@ *`?([0-9a-f]{7,40}).*/\1/p' | head -1)
  [ -n "$base" ] || continue
  deps=$(printf '%s\n' "$texto" | sed -nE 's/.*Depende de\*?\*?[ |:]*(.*)$/\1/p' | head -1 | tr -d '`|' | tr ',' ' ')
  for dep in $deps; do
    [ "$dep" = "—" ] && continue
    if git log --merges --oneline "$base..origin/develop" 2>/dev/null | grep -Eq "/feature/$dep( |$)"; then
      echo "⚠ $(basename "$spec" .md): spec rever, $dep entrou na develop depois da base $base"
    fi
  done
done >>"${TMPDIR:-/tmp}/checar-atraso.$$"

if [ -s "${TMPDIR:-/tmp}/checar-atraso.$$" ]; then
  echo "Atrasos e pendências (checar-atraso):"
  cat "${TMPDIR:-/tmp}/checar-atraso.$$"
else
  echo "checar-atraso: tudo em dia"
fi
rm -f "${TMPDIR:-/tmp}/checar-atraso.$$"
