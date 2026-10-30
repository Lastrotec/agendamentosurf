// Aplica migrações SQL em ordem (idempotente). Uso: DATABASE_URL=... npm run db:migrate [-- --seed]
// Use a conexão direta/sessão (porta 5432) do Supabase para migrações, não o pooler em modo transação.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import postgres from 'postgres';

export async function migrate(url: string, opts: { seed?: boolean; quiet?: boolean } = {}) {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  const log = (m: string) => !opts.quiet && console.log(m);
  try {
    await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
    await sql`alter table schema_migrations enable row level security`;
    const dir = join(import.meta.dirname, '..', 'db', 'migrations');
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    const done = new Set((await sql<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name));
    for (const f of files) {
      if (done.has(f)) continue;
      const body = readFileSync(join(dir, f), 'utf8');
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into schema_migrations (name) values (${f})`;
      });
      log(`✔ migração aplicada: ${f}`);
    }
    if (opts.seed) {
      await sql.unsafe(readFileSync(join(dir, '..', 'seed.sql'), 'utf8'));
      log('✔ dados iniciais aplicados');
    }
  } finally {
    await sql.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Defina DATABASE_URL.');
    process.exit(1);
  }
  migrate(url, { seed: process.argv.includes('--seed') }).catch((e) => {
    console.error('Falha na migração:', e.message);
    process.exit(1);
  });
}
