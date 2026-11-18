#!/bin/sh
# Restaura um backup gerado por scripts/backup-db.sh num banco de destino.
# Uso: scripts/restore-db.sh [--force] arquivo.sql.gz.gpg
#
# Variáveis de ambiente (nunca passe a senha como argumento):
#   RESTORE_DATABASE_URL  conexão do banco de DESTINO (use uma branch descartável do Neon, nunca a de produção). Obrigatória.
#   BACKUP_PASSPHRASE     a senha com que o backup foi cifrado. Obrigatória.
# O destino precisa estar vazio (sem tabelas). Com --force o script apaga tudo do schema "public" do destino antes
# de restaurar. Precisa de psql, gzip e gpg no PATH.
set -eu

erro() {
  echo "Erro: $*" >&2
  exit 1
}

force=0
arquivo=""
for argumento in "$@"; do
  case "$argumento" in
    --force) force=1 ;;
    -*) erro "opção desconhecida: $argumento (uso: restore-db.sh [--force] arquivo.sql.gz.gpg)" ;;
    *)
      [ -z "$arquivo" ] || erro "informe um arquivo só (uso: restore-db.sh [--force] arquivo.sql.gz.gpg)"
      arquivo="$argumento"
      ;;
  esac
done

[ -n "$arquivo" ] || erro "informe o arquivo do backup (uso: restore-db.sh [--force] arquivo.sql.gz.gpg)"
[ -f "$arquivo" ] || erro "o arquivo não existe: $arquivo"
[ -n "${RESTORE_DATABASE_URL:-}" ] || erro "falta a variável RESTORE_DATABASE_URL (a conexão do banco de destino)."
[ -n "${BACKUP_PASSPHRASE:-}" ] || erro "falta a variável BACKUP_PASSPHRASE (a senha do backup)."
for comando in psql gzip gpg; do
  command -v "$comando" >/dev/null 2>&1 || erro "o comando \"$comando\" não está instalado."
done

umask 077
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT INT TERM

# Decifra antes de encostar no banco: senha errada ou arquivo estragado falham aqui, sem tocar no destino.
echo "Decifrando o backup..." >&2
if ! printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --yes --quiet --pinentry-mode loopback \
  --passphrase-fd 0 --decrypt --output "$tmp/dump.sql.gz" "$arquivo" 2>"$tmp/gpg.err"; then
  erro "não consegui decifrar o backup: a senha (BACKUP_PASSPHRASE) está errada ou o arquivo está corrompido."
fi
if ! gzip -t "$tmp/dump.sql.gz" 2>/dev/null; then
  erro "o backup decifrou, mas o conteúdo está corrompido (gzip inválido)."
fi

tabelas="$(psql "$RESTORE_DATABASE_URL" --no-psqlrc --tuples-only --no-align --quiet -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema')" 2>"$tmp/psql.err")" || {
  cat "$tmp/psql.err" >&2
  erro "não consegui conectar no banco de destino (confira RESTORE_DATABASE_URL)."
}

limpou=0
if [ "$tabelas" != "0" ]; then
  if [ "$force" -ne 1 ]; then
    erro "o banco de destino já tem $tabelas tabela(s). Restaure num banco vazio (uma branch nova do Neon) ou use --force para apagar o que há nele."
  fi
  echo "Atenção: --force, apagando tudo do schema public do destino..." >&2
  psql "$RESTORE_DATABASE_URL" --no-psqlrc --quiet -v ON_ERROR_STOP=1 \
    -c 'DROP SCHEMA public CASCADE' -c 'CREATE SCHEMA public' >/dev/null ||
    erro "não consegui limpar o schema public do destino."
  limpou=1
fi

echo "Restaurando..." >&2
if ! gzip -dc "$tmp/dump.sql.gz" | psql "$RESTORE_DATABASE_URL" --no-psqlrc --quiet \
  -v ON_ERROR_STOP=1 --single-transaction >/dev/null 2>"$tmp/psql.err"; then
  cat "$tmp/psql.err" >&2
  if [ "$limpou" -eq 1 ]; then
    erro "a restauração falhou. Como você usou --force, o schema public do destino já tinha sido apagado: o destino está vazio ou incompleto. Confira a versão do psql e do servidor e rode de novo."
  fi
  erro "a restauração falhou e foi desfeita (o destino ficou como estava). Confira a versão do psql e do servidor."
fi

# Mesmo formato do backup-db.sh ("tabela<TAB>linhas"): compare as duas listas para provar que nada se perdeu.
echo "Linhas por tabela no destino restaurado:" >&2
psql "$RESTORE_DATABASE_URL" --no-psqlrc --tuples-only --no-align --quiet -F "$(printf '\t')" -c \
  "SELECT table_name, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'" |
  LC_ALL=C sort >&2

echo "Restauração concluída." >&2
