#!/usr/bin/env bash
# Restauração de um backup criptografado. NUNCA aponte para produção sem aprovação explícita.
# Uso: AGE_IDENTITY=~/chave-outside.txt TARGET_DATABASE_URL=postgres://...teste scripts/restore.sh outside-XXXX.dump.age
set -euo pipefail
export PGOPTIONS="-c client_min_messages=warning"
FILE="${1:?informe o arquivo .dump.age}"
: "${AGE_IDENTITY:?defina AGE_IDENTITY (arquivo da chave PRIVADA, guardada fora do GitHub)}"
: "${TARGET_DATABASE_URL:?defina TARGET_DATABASE_URL (banco de TESTE)}"
if [ -f "$FILE.sha256" ]; then (cd "$(dirname "$FILE")" && sha256sum -c "$(basename "$FILE").sha256"); else echo "⚠ sem arquivo .sha256 — integridade não verificada"; fi
if [[ "$TARGET_DATABASE_URL" == *supabase.co* || "$TARGET_DATABASE_URL" == *pooler.supabase.com* ]] && [ "${I_UNDERSTAND_THIS_OVERWRITES_PRODUCTION:-}" != "sim" ]; then
  echo "✘ Destino parece ser o Supabase. Para restaurar em produção defina I_UNDERSTAND_THIS_OVERWRITES_PRODUCTION=sim (somente com aprovação)."
  exit 1
fi
WORK="$(mktemp -d)"; chmod 700 "$WORK"; trap 'shred -u "$WORK"/* 2>/dev/null; rm -rf "$WORK"' EXIT
age --decrypt --identity "$AGE_IDENTITY" --output "$WORK/db.dump" "$FILE"
pg_restore --list "$WORK/db.dump" | grep -v ' SCHEMA - public ' > "$WORK/restore.list"
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -qc "create schema if not exists public; create extension if not exists btree_gist with schema public;" >/dev/null
pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error --use-list="$WORK/restore.list" --dbname="$TARGET_DATABASE_URL" "$WORK/db.dump"
psql "$TARGET_DATABASE_URL" -c "select (select count(*) from businesses) barbearias, (select count(*) from services) servicos, (select count(*) from customers) clientes, (select count(*) from bookings) agendamentos, (select max(name) from schema_migrations) ultima_migracao;"
echo "✔ Restaurado. Valide clientes/agendamentos antes de qualquer uso."
