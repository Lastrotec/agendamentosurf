import postgres, { type Sql } from 'postgres';

import { migrate } from '../../scripts/migrate';
import { createApp } from '../../src/worker/app';
import type { Env } from '../../src/worker/env';
import { bytesToB64url, randomBytes } from '../../src/worker/lib/crypto';
import { createAdmin } from '../../src/worker/services/auth';

export const TEST_DB = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/outside_test';
export const ORIGIN = 'http://localhost';

export async function resetDb(): Promise<Sql> {
  const admin = postgres(TEST_DB, { max: 1, onnotice: () => {} });
  await admin.unsafe('drop schema if exists public cascade; create schema public;');
  await admin.end();
  await migrate(TEST_DB, { seed: true, quiet: true });
  // Mesmas opções do Worker (sem prepared statements nem busca de tipos).
  return postgres(TEST_DB, { max: 20, prepare: false, fetch_types: false, onnotice: () => {} });
}

export function makeEnv(sql: Sql, extra: Partial<Env> = {}): Env {
  return { TEST_SQL: sql, ENVIRONMENT: 'test', DATA_ENCRYPTION_KEY: bytesToB64url(randomBytes(32)), RATE_LIMIT_SALT: 'test', REQUIRE_MFA: 'false', ...extra };
}

export class Client {
  cookies = new Map<string, string>();
  constructor(
    public app: ReturnType<typeof createApp>,
    public env: Env,
    public ip = `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
  ) {}

  async req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const h: Record<string, string> = { 'x-forwarded-for': this.ip, origin: ORIGIN, ...headers };
    if (method !== 'GET') h['x-requested-with'] = h['x-requested-with'] ?? 'outside';
    if (body !== undefined) h['content-type'] = 'application/json';
    if (this.cookies.size) h.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await this.app.request(`${ORIGIN}${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }, this.env);
    for (const sc of res.headers.getSetCookie?.() ?? []) {
      const [pair] = sc.split(';');
      const [k, v] = pair.split('=');
      if (/max-age=0/i.test(sc) || v === '') this.cookies.delete(k);
      else this.cookies.set(k, v);
    }
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, json, headers: res.headers };
  }
  get(p: string) {
    return this.req('GET', p);
  }
  post(p: string, b: unknown = {}) {
    return this.req('POST', p, b);
  }
  put(p: string, b: unknown) {
    return this.req('PUT', p, b);
  }
  del(p: string) {
    return this.req('DELETE', p);
  }
}

export const ADMIN = { email: 'romario@teste.com.br', password: 'senha-segura-123' };

export async function setupAdmin(sql: Sql) {
  await createAdmin(sql, ADMIN.email, 'Romário de Jesus', ADMIN.password);
  // Testes: sem antecedência mínima para poder agendar hoje/amanhã.
  await sql`update settings set min_notice_hours = 0`;
}

/** Próxima data com aula em Jaguaribe (não terça), pelo menos `minDays` à frente. */
export function nextClassDay(minDays = 2): string {
  const d = new Date(Date.now() + minDays * 86400000);
  while (d.getUTCDay() === 2) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function idem() {
  return bytesToB64url(randomBytes(18));
}

let phoneSeq = 10000000;
export const newPhone = () => `(71) 9${String(++phoneSeq).slice(-8)}`;
