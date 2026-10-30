import type { Sql } from 'postgres';

import { tooMany } from './errors';

/**
 * Limite de taxa em janela fixa, persistido no Postgres (sem custo extra e consistente entre isolates).
 * Usado só em rotas sensíveis (agendar, OTP, login), que já acessam o banco.
 */
export async function rateLimit(sql: Sql, key: string, limit: number, windowSeconds: number): Promise<void> {
  const [row] = await sql<{ count: number }[]>`
    insert into rate_limits as r (key, window_start, count) values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when r.window_start < now() - make_interval(secs => ${windowSeconds}) then 1 else r.count + 1 end,
      window_start = case when r.window_start < now() - make_interval(secs => ${windowSeconds}) then now() else r.window_start end
    returning count`;
  if (row.count > limit) throw tooMany();
}
