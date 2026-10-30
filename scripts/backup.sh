#!/usr/bin/env bash
# Backup criptografado do banco (usado pelo GitHub Actions e manualmente).
# Uso: DATABASE_URL=... AGE_RECIPIENT=age1... [VERIFY_DATABASE_URL=...] scripts/backup.sh <pasta-saida>
# - Gera dump (formato custom) do schema public: estrutura + dados.
# - Opcional: restaura num banco ISOLADO (VERIFY_DATABASE_URL) e confere tabelas/contagens.
# - Criptografa com age (chave PÚBLICA); remove o texto puro; gera SHA-256 do arquivo cifrado.
set -euo pipefail
export PGOPTIONS="-c client_min_messages=warning"
OUT="${1:?informe a pasta de saída}"
: "${DATABASE_URL:?defina DATABASE_URL (conexão direta/sessão, porta 5432)}"
: "${AGE_RECIPIENT:?defina AGE_RECIPIENT (chave pública age1...)}"
mkdir -p "$OUT"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK="$(mktemp -d)"
chmod 700 "$WORK"
PLAIN="$WORK/toni-$STAMP.dump"
cleanup() { if [ -f "$PLAIN" ]; then shred -u "$PLAIN" 2>/dev/null || rm -f "$PLAIN"; fi; rm -rf "$WORK"; }
trap cleanup EXIT

echo "→ Gerando dump ($STAMP)"
pg_dump --format=custom --compress=9 --no-owner --no-privileges --schema=public --file="$PLAIN" "$DATABASE_URL"
[ -s "$PLAIN" ] || { echo "✘ dump vazio"; exit 1; }
pg_restore --list "$PLAIN" > "$WORK/toc.txt"
for t in businesses bookings customers services schema_migrations audit_log; do
  grep -q "TABLE DATA public $t " "$WORK/toc.txt" || { echo "✘ tabela $t ausente no dump"; exit 1; }
done
echo "✔ dump válido ($(stat -c%s "$PLAIN") bytes, $(grep -c 'TABLE DATA' "$WORK/toc.txt") tabelas com dados)"

if [ -n "${VERIFY_DATABASE_URL:-}" ]; then
  echo "→ Teste de restauração em banco isolado"
  psql "$VERIFY_DATABASE_URL" -v ON_ERROR_STOP=1 -qc "drop schema if exists public cascade; create schema public; create extension if not exists btree_gist;" >/dev/null
  grep -v ' SCHEMA - public ' "$WORK/toc.txt" > "$WORK/restore.list"
  pg_restore --no-owner --no-privileges --exit-on-error --use-list="$WORK/restore.list" --dbname="$VERIFY_DATABASE_URL" "$PLAIN"
  SRC=$(psql "$DATABASE_URL" -Atc "select (select count(*) from bookings)||'/'||(select count(*) from customers)||'/'||(select count(*) from services)||'/'||(select count(*) from businesses)")
  DST=$(psql "$VERIFY_DATABASE_URL" -Atc "select (select count(*) from bookings)||'/'||(select count(*) from customers)||'/'||(select count(*) from services)||'/'||(select count(*) from businesses)")
  echo "  contagens (agendamentos/clientes/serviços/barbearias) origem=$SRC restaurado=$DST"
  [ "$SRC" = "$DST" ] || echo "  (diferença pode ocorrer se houve escrita durante o dump)"
  psql "$VERIFY_DATABASE_URL" -Atc "select count(*) from bookings where tstzrange(starts_at, block_ends_at) is not null" >/dev/null
  [ "$(psql "$VERIFY_DATABASE_URL" -Atc "select count(*) from businesses")" -ge 1 ] || { echo "✘ restauração sem dados"; exit 1; }
  echo "✔ restauração verificada"
  psql "$VERIFY_DATABASE_URL" -qc "drop schema public cascade; create schema public;" >/dev/null
fi

ENC="$OUT/toni-$STAMP.dump.age"
age --encrypt --recipient "$AGE_RECIPIENT" --output "$ENC" "$PLAIN"
shred -u "$PLAIN" 2>/dev/null || rm -f "$PLAIN"
[ -s "$ENC" ] || { echo "✘ arquivo criptografado vazio"; exit 1; }
head -c 21 "$ENC" | grep -q "age-encryption.org/v1" || { echo "✘ formato age inválido"; exit 1; }
(cd "$OUT" && sha256sum "$(basename "$ENC")" > "$(basename "$ENC").sha256")
echo "✔ backup criptografado: $ENC"
echo "BACKUP_FILE=$ENC" >> "${GITHUB_OUTPUT:-/dev/null}"
