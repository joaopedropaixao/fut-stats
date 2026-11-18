#!/bin/sh
# Backup do banco: pg_dump em texto, compactado com gzip e cifrado com gpg (AES256, senha simétrica).
# Gera "fut-stats-AAAA-MM-DD.sql.gz.gpg" em BACKUP_DIR (padrão: pasta atual) e imprime o caminho.
#
# Variáveis de ambiente (nunca passe a senha como argumento: ela apareceria na lista de processos):
#   DIRECT_URL         conexão direta do banco (no Neon, a URL SEM "-pooler"). Obrigatória.
#   BACKUP_PASSPHRASE  senha que cifra o arquivo. Obrigatória. Sem ela, o arquivo não serve para ninguém.
#   BACKUP_DIR         onde gravar o arquivo (padrão: .).
# Precisa de pg_dump (na mesma versão principal do servidor), gzip e gpg no PATH.
# Restaurar: scripts/restore-db.sh. Passo a passo em docs/deploy.md ("Como restaurar um backup").
set -eu

erro() {
  echo "Erro: $*" >&2
  exit 1
}

[ -n "${DIRECT_URL:-}" ] || erro "falta a variável DIRECT_URL (a conexão direta do banco, sem \"-pooler\")."
[ -n "${BACKUP_PASSPHRASE:-}" ] || erro "falta a variável BACKUP_PASSPHRASE (a senha que cifra o backup)."
for comando in pg_dump gzip gpg; do
  command -v "$comando" >/dev/null 2>&1 || erro "o comando \"$comando\" não está instalado."
done

destino="${BACKUP_DIR:-.}"
[ -d "$destino" ] || erro "a pasta BACKUP_DIR não existe: $destino"
arquivo="$destino/fut-stats-$(date -u +%Y-%m-%d).sql.gz.gpg"

# Pasta temporária só nossa; o dump em texto puro nunca fica fora dela e some no fim, com ou sem erro.
umask 077
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT INT TERM

echo "Gerando o dump do banco..." >&2
if ! pg_dump --no-owner --no-privileges --format=plain "$DIRECT_URL" >"$tmp/dump.sql" 2>"$tmp/pg_dump.err"; then
  # Mostra o erro do pg_dump sem a senha do banco (a URL nem é impressa).
  cat "$tmp/pg_dump.err" >&2
  erro "o pg_dump falhou (conexão, senha do banco ou versão do pg_dump menor que a do servidor)."
fi

echo "Compactando e cifrando..." >&2
gzip -c "$tmp/dump.sql" >"$tmp/dump.sql.gz"
if ! printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --yes --quiet --pinentry-mode loopback \
  --passphrase-fd 0 --symmetric --cipher-algo AES256 --compress-algo none \
  --output "$arquivo" "$tmp/dump.sql.gz"; then
  rm -f "$arquivo"
  erro "o gpg não conseguiu cifrar o backup."
fi

echo "Backup pronto: $arquivo" >&2
echo "$arquivo"
