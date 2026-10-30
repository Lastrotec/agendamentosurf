import type { ZodType } from 'zod';

import type { Ctx } from '../types';
import { badRequest } from './errors';
import { sha256Hex } from './crypto';

export async function parseJson<T>(c: Ctx, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    const text = await c.req.text();
    if (text.length > 20_000) throw badRequest('Requisição muito grande.');
    body = text ? JSON.parse(text) : {};
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    throw badRequest('JSON inválido.');
  }
  const r = schema.safeParse(body);
  if (!r.success) {
    const first = r.error.issues[0];
    throw badRequest(first?.message ?? 'Dados inválidos.', 'VALIDATION', r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  return r.data;
}

export function parseQuery<T>(c: Ctx, schema: ZodType<T>): T {
  const r = schema.safeParse(c.req.query());
  if (!r.success) throw badRequest(r.error.issues[0]?.message ?? 'Parâmetros inválidos.', 'VALIDATION');
  return r.data;
}

/** IP do cliente (Cloudflare) pseudonimizado — nunca armazenamos o IP em claro. */
export async function clientIpKey(c: Ctx): Promise<string> {
  const ip =
    c.req.header('cf-connecting-ip') ??
    (c.env.ENVIRONMENT !== 'production' ? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() : undefined) ??
    'unknown';
  return (await sha256Hex(`${c.env.RATE_LIMIT_SALT ?? 'outside'}:${ip}`)).slice(0, 32);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function paramId(c: Ctx, name = 'id'): string {
  const v = c.req.param(name);
  if (!v || !UUID_RE.test(v)) throw badRequest('Identificador inválido.');
  return v;
}
