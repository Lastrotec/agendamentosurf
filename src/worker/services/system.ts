// Status operacional para o painel (Sistema → Monitoramento). Só exibe dados realmente medidos.

import type { Sql } from 'postgres';

import type { Env } from '../env';

export interface StatusRow {
  key: string;
  ok: boolean | null;
  last_success_at: Date | null;
  last_failure_at: Date | null;
  detail: string | null;
  updated_at: Date;
}

/** Verificação real e leve do banco: leitura de uma linha de uma tabela dedicada (sem dados pessoais). */
export async function dbPing(sql: Sql): Promise<number> {
  const t = Date.now();
  await sql`select note from health_check where id = 1`;
  return Date.now() - t;
}

export async function recordStatus(sql: Sql, key: string, ok: boolean, detail: string | null) {
  await sql`
    insert into system_status (key, ok, last_success_at, last_failure_at, detail, updated_at)
    values (${key}, ${ok}, ${ok ? new Date() : null}, ${ok ? null : new Date()}, ${detail}, now())
    on conflict (key) do update set ok = excluded.ok,
      last_success_at = coalesce(excluded.last_success_at, system_status.last_success_at),
      last_failure_at = coalesce(excluded.last_failure_at, system_status.last_failure_at),
      detail = excluded.detail, updated_at = now()`;
}

export async function systemStatus(sql: Sql, env: Env) {
  let db: { ok: boolean; latencyMs: number | null; sizeBytes: number | null; error?: string } = { ok: false, latencyMs: null, sizeBytes: null };
  try {
    const latencyMs = await dbPing(sql);
    let sizeBytes: number | null = null;
    try {
      const [r] = await sql<{ size: string }[]>`select pg_database_size(current_database())::text as size`;
      sizeBytes = Number(r.size);
    } catch {
      sizeBytes = null;
    }
    db = { ok: true, latencyMs, sizeBytes };
  } catch {
    db = { ok: false, latencyMs: null, sizeBytes: null, error: 'Falha ao conectar' };
  }
  let rows: StatusRow[] = [];
  let counts: { table: string; rows: number }[] = [];
  if (db.ok) {
    rows = await sql<StatusRow[]>`select * from system_status`;
    // Contagem exata: as tabelas são pequenas (uma barbearia) e a estimativa do Postgres fica em 0 até o próximo ANALYZE.
    counts = await sql<{ table: string; rows: number }[]>`
      select 'alunos' as table, (select count(*) from students where anonymized_at is null)::int as rows
      union all select 'aulas', (select count(*) from bookings)::int
      union all select 'imagens', (select count(*) from images)::int
      union all select 'auditoria', (select count(*) from audit_log)::int`;
  }
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  const lastBackup = byKey.backup?.last_success_at ? new Date(byKey.backup.last_success_at) : null;
  const backupAgeHours = lastBackup ? (Date.now() - lastBackup.getTime()) / 3_600_000 : null;
  const alerts: string[] = [];
  if (!db.ok) alerts.push('Banco de dados inacessível.');
  if (byKey.cron_db && byKey.cron_db.ok === false) alerts.push('Última verificação agendada do banco falhou.');
  if (backupAgeHours === null) alerts.push('Nenhum backup registrado ainda.');
  else if (backupAgeHours > 14) alerts.push(`Último backup há ${Math.round(backupAgeHours)}h (esperado a cada 12h).`);
  if (byKey.backup && byKey.backup.ok === false) alerts.push('Último backup falhou.');
  // Supabase Free: 500 MB de banco (verifique o limite atual no painel do Supabase).
  const FREE_DB_LIMIT = 500 * 1024 * 1024;
  if (db.sizeBytes && db.sizeBytes > FREE_DB_LIMIT * 0.8) alerts.push('Banco acima de 80% do limite do plano gratuito.');

  return {
    checkedAt: new Date().toISOString(),
    environment: env.ENVIRONMENT ?? 'development',
    application: { ok: true },
    database: { ...db, freeTierLimitBytes: FREE_DB_LIMIT, tables: counts },
    cron: byKey.cron_db ?? null,
    backup: byKey.backup ?? null,
    restoreTest: byKey.restore_test ?? null,
    forecast: byKey.forecast ?? null,
    integrations: { push: !!env.VAPID_PRIVATE_JWK, hyperdrive: !!env.HYPERDRIVE },
    alerts,
  };
}
