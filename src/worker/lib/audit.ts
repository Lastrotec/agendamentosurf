import type { Sql, TransactionSql } from 'postgres';

export type ActorType = 'ADMIN' | 'STUDENT' | 'SYSTEM';

export async function audit(
  sql: Sql | TransactionSql,
  e: { actorType: ActorType; actorId?: string | null; action: string; entity: string; entityId?: string | null; data?: Record<string, unknown> },
): Promise<void> {
  await sql`
    insert into audit_log (actor_type, actor_id, action, entity, entity_id, data)
    values (${e.actorType}, ${e.actorId ?? null}, ${e.action}, ${e.entity}, ${e.entityId ?? null}, ${sql.json((e.data ?? {}) as never)})`;
}
