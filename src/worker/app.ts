import { Hono } from 'hono';

import { createSql } from './lib/db';
import { AppError } from './lib/errors';
import { clientIpKey } from './lib/http';
import { adminRoutes } from './routes/admin';
import { publicRoutes } from './routes/public';
import { studentRoutes } from './routes/student';
import { loadSettings, type SettingsRow } from './services/settings';
import type { AppEnv } from './types';

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

// Configurações em memória do isolate por alguns segundos: poupa uma ida ao banco por requisição.
// O painel sempre lê do banco e qualquer alteração dele limpa esta memória.
const SETTINGS_TTL_MS = 10_000;
let memo: { at: number; value: Promise<SettingsRow> } | null = null;

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    let handle: ReturnType<typeof createSql> | null = null;
    let settings: Promise<SettingsRow> | null = null;
    c.set('db', () => (handle ??= createSql(c.env)).sql);
    c.set('settings', () => {
      if (settings) return settings;
      const admin = c.req.path.startsWith('/api/admin/');
      if (!admin && !c.env.TEST_SQL && memo && Date.now() - memo.at < SETTINGS_TTL_MS) return (settings = memo.value);
      settings = loadSettings(c.get('db')());
      if (!admin && !c.env.TEST_SQL) {
        memo = { at: Date.now(), value: settings };
        settings.catch(() => (memo = null));
      }
      return settings;
    });
    c.set('ipKey', await clientIpKey(c));
    try {
      await next();
      if (c.req.path.startsWith('/api/admin/') && c.req.method !== 'GET') memo = null;
    } finally {
      if (handle) {
        const p = (handle as ReturnType<typeof createSql>).close().catch(() => {});
        try {
          c.executionCtx.waitUntil(p);
        } catch {
          await p;
        }
      }
    }
  });

  app.use('*', async (c, next) => {
    await next();
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) c.header(k, v);
    if ((c.req.path.startsWith('/api/') || c.req.path.startsWith('/health')) && !c.res.headers.get('Cache-Control')?.startsWith('public')) c.header('Cache-Control', 'no-store');
  });

  // CSRF: mutações exigem cabeçalho próprio (força preflight, que não é liberado) e Origin do próprio site.
  app.use('/api/*', async (c, next) => {
    const m = c.req.method;
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return next();
    if (c.req.header('x-requested-with') !== 'outside') throw new AppError(403, 'Requisição bloqueada.', 'CSRF');
    const origin = c.req.header('origin');
    if (origin) {
      const allowed = [new URL(c.req.url).origin, c.env.APP_ORIGIN].filter(Boolean);
      if (!allowed.includes(origin)) throw new AppError(403, 'Origem não permitida.', 'CSRF');
    }
    return next();
  });

  // Monitor externo (UptimeRobot): resposta leve sem banco.
  app.get('/health', (c) => c.json({ status: 'ok', service: 'outside-surf', time: new Date().toISOString() }));
  // Com leitura real do banco (mantém o Supabase ativo se o monitor apontar para cá). Cache de 60 s na borda.
  app.get('/health/db', async (c) => {
    const t = Date.now();
    await c.get('db')()`select note from health_check where id = 1`;
    c.header('Cache-Control', 'public, max-age=60');
    return c.json({ status: 'ok', db: 'ok', ms: Date.now() - t });
  });

  app.route('/api/public', publicRoutes);
  app.route('/api/me', studentRoutes);
  app.route('/api/admin', adminRoutes);
  app.all('/api/*', (c) => c.json({ error: 'Rota não encontrada.', code: 'NOT_FOUND' }, 404));

  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code, details: err.details }, err.status);
    console.error(JSON.stringify({ level: 'error', path: c.req.path, message: err instanceof Error ? err.message : String(err) }));
    return c.json({ error: 'Ocorreu um erro inesperado. Tente novamente em instantes.', code: 'INTERNAL' }, 500);
  });

  return app;
}
