import type { Sql } from 'postgres';

import type { Ctx } from '../types';
import { createSql } from './db';

/** Tarefa depois da resposta (ex.: push), com conexão própria: a da requisição é fechada ao responder. */
export function background(c: Ctx, job: (sql: Sql) => Promise<unknown>) {
  if (c.env.TEST_SQL) {
    // Testes: executa na hora com o cliente compartilhado (sem waitUntil no Node).
    void job(c.env.TEST_SQL).catch(() => {});
    return;
  }
  const env = c.env;
  const task = (async () => {
    const { sql, close } = createSql(env);
    try {
      await job(sql);
    } catch (e) {
      console.error(JSON.stringify({ level: 'warn', job: 'background', message: e instanceof Error ? e.message : String(e) }));
    } finally {
      await close().catch(() => {});
    }
  })();
  try {
    c.executionCtx.waitUntil(task);
  } catch {
    void task;
  }
}
