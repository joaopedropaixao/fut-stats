# Base dos hooks: lê o JSON do stdin e oferece field/deny/branch_of.
# Se não der para decidir (sem jq, entrada que não é JSON), o hook libera.

input=$(cat)
command -v jq >/dev/null 2>&1 || exit 0
printf '%s' "$input" | jq -e . >/dev/null 2>&1 || exit 0

# field <caminho jq>: valor do campo, vazio se faltar.
field() { printf '%s' "$input" | jq -r "$1 // empty" 2>/dev/null; }

# deny <motivo>: bloqueia a ferramenta; o Claude lê o motivo.
deny() {
  echo "$1" >&2
  exit 2
}

# branch_of <dir>: branch do repo que contém <dir> (sobe até achar uma pasta que exista).
branch_of() {
  d=$1
  while [ ! -d "$d" ]; do d=$(dirname "$d"); done
  git -C "$d" branch --show-current 2>/dev/null
}

cwd=$(field .cwd)
cwd=${cwd:-$PWD}
