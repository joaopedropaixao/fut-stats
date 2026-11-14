#!/bin/sh
# Quadro da v1: uma linha por fatia, no checkout principal (fora do git). É a fonte da verdade de quem está onde.
#
#   quadro.sh set <fatia> <etapa> [toca-em] [bloqueio]   de dentro do worktree da fatia, a cada mudança de etapa
#   quadro.sh aviso <fatia> <texto>                      orquestrador: aviso que a equipe precisa tratar ("-" limpa)
#   quadro.sh show [fatia]                               tabela (ou só a linha da fatia)
#   quadro.sh afetados < arquivos.txt                    fatias cujo "toca-em" cruza a lista de arquivos (um por linha)
#   quadro.sh rm <fatia>                                 tira a fatia do quadro (depois do merge)
#
# toca-em: prefixos de caminho separados por vírgula, ex.:
#   apps/api/prisma/schema.prisma,packages/shared/src/match.ts,apps/web/src/features/match
# Campo vazio no set mantém o valor anterior; "-" limpa.

set -u
SEP=$(printf '\t')

main_checkout() {
  git worktree list --porcelain 2>/dev/null | awk '/^worktree / { print substr($0, 10); exit }'
}

MAIN=${QUADRO_MAIN:-$(main_checkout)}
[ -n "$MAIN" ] || { echo "quadro: fora de um repositório git" >&2; exit 1; }
FILE="$MAIN/.claude/quadro-v1.local.tsv"
mkdir -p "$MAIN/.claude"
touch "$FILE"

trava() {
  n=0
  until mkdir "$FILE.lock" 2>/dev/null; do
    n=$((n + 1))
    [ "$n" -gt 50 ] && { echo "quadro: travado ($FILE.lock); apague se ninguém estiver escrevendo" >&2; exit 1; }
    sleep 0.1
  done
  trap 'rmdir "$FILE.lock" 2>/dev/null' EXIT
}

campo() { # campo <fatia> <n>
  awk -F "$SEP" -v f="$1" -v n="$2" '$1 == f { print $n }' "$FILE"
}

grava() { # grava <linha completa, separada por tab>
  fatia=$(printf '%s' "$1" | cut -f1)
  awk -F "$SEP" -v f="$fatia" '$1 != f' "$FILE" >"$FILE.tmp"
  printf '%s\n' "$1" >>"$FILE.tmp"
  mv "$FILE.tmp" "$FILE"
}

quando() { # epoch → hora local legível (BSD ou GNU date)
  date -r "$1" '+%d/%m %H:%M' 2>/dev/null || date -d "@$1" '+%d/%m %H:%M'
}

estado_push() {
  b=$(git branch --show-current)
  if git rev-parse -q --verify "origin/$b" >/dev/null; then
    a=$(git rev-list --count "origin/$b..HEAD")
    r=$(git rev-list --count "HEAD..origin/$b")
    if [ "$a" -gt 0 ] && [ "$r" -gt 0 ]; then echo "divergiu ($a local, $r remoto)"
    elif [ "$a" -gt 0 ]; then echo "$a sem push"
    else echo ok; fi
  else
    a=$(git rev-list --count origin/develop..HEAD 2>/dev/null || echo 0)
    if [ "$a" -gt 0 ]; then echo "sem remoto ($a commits)"; else echo ok; fi
  fi
}

cmd=${1:-show}
case $cmd in
  set)
    [ $# -ge 3 ] || { echo "uso: quadro.sh set <fatia> <etapa> [toca-em] [bloqueio]" >&2; exit 1; }
    fatia=$2 etapa=$3 toca=${4:-} bloq=${5:-}
    root=$(git rev-parse --show-toplevel)
    base=$(git merge-base HEAD origin/develop 2>/dev/null | cut -c1-7)
    atras=$(git rev-list --count HEAD..origin/develop 2>/dev/null || echo "?")
    push=$(estado_push)
    trava
    [ -z "$toca" ] && toca=$(campo "$fatia" 6)
    [ -z "$bloq" ] && bloq=$(campo "$fatia" 7)
    [ "$toca" = "-" ] && toca=""
    [ "$bloq" = "-" ] && bloq=""
    grava "$fatia$SEP$etapa$SEP${base:-?}$SEP$atras$SEP$push$SEP$toca$SEP$bloq$SEP$(date +%s)$SEP$root"
    # A status line do worktree mostra a etapa.
    mkdir -p "$root/.claude" && printf '%s\n' "$etapa" >"$root/.claude/etapa.local"
    ;;
  aviso)
    [ $# -ge 3 ] || { echo "uso: quadro.sh aviso <fatia> <texto>" >&2; exit 1; }
    trava
    linha=$(awk -F "$SEP" -v f="$2" '$1 == f' "$FILE")
    [ -n "$linha" ] || { echo "quadro: fatia $2 não está no quadro" >&2; exit 1; }
    texto=$3
    [ "$texto" = "-" ] && texto=""
    grava "$(printf '%s' "$linha" | awk -F "$SEP" -v OFS="$SEP" -v t="$texto" '{ $7 = t; print }')"
    ;;
  rm)
    trava
    awk -F "$SEP" -v f="$2" '$1 != f' "$FILE" >"$FILE.tmp" && mv "$FILE.tmp" "$FILE"
    ;;
  afetados)
    # Lista de arquivos no stdin; imprime as fatias com algum prefixo do "toca-em" contido num dos caminhos.
    cat >"$FILE.arquivos"
    awk -F "$SEP" -v lista="$FILE.arquivos" '
      BEGIN { while ((getline l < lista) > 0) arq[++n] = l }
      $6 != "" {
        k = split($6, pref, ",")
        for (i = 1; i <= k; i++) {
          if (pref[i] == "") continue
          for (j = 1; j <= n; j++) if (index(arq[j], pref[i]) > 0) { print $1; next }
        }
      }' "$FILE" | sort -u
    rm -f "$FILE.arquivos"
    ;;
  show)
    printf 'fatia\tetapa\tbase\tatrás\tpush\ttoca em\taviso/bloqueio\tatualizado\n'
    # awk, não read: o read junta tabs seguidos e some com campo vazio.
    awk -F "$SEP" -v OFS="$SEP" -v f="${2:-}" -v agora="$(date +%s)" -v limite="${QUADRO_PARADO_S:-7200}" '
      f == "" || $1 == f {
        marca = (agora - $8 > limite) ? " ⚠ parado" : ""
        print $1, $2, $3, $4, $5, ($6 == "" ? "-" : $6), ($7 == "" ? "-" : $7), $8 marca
      }' "$FILE" | sort | while IFS= read -r linha; do
      ts=$(printf '%s' "$linha" | cut -f8 | cut -d' ' -f1)
      resto=$(printf '%s' "$linha" | cut -f8 | cut -s -d' ' -f2-)
      printf '%s\t%s%s\n' "$(printf '%s' "$linha" | cut -f1-7)" "$(quando "$ts")" "${resto:+ $resto}"
    done
    ;;
  *)
    echo "uso: quadro.sh set|aviso|show|afetados|rm" >&2
    exit 1
    ;;
esac
