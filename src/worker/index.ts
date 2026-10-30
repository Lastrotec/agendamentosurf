// Entrada do Worker: API (Hono), imagens do banco com cache eterno, HTML da SPA e Cron.
import { createApp, SECURITY_HEADERS } from './app';
import type { Env } from './env';
import { CSP } from './html-config';
import { createSql } from './lib/db';
import { expireHolds } from './services/bookings';
import { refreshForecasts } from './services/forecast';
import { deleteUnusedImages } from './services/images';
import { runReminders } from './services/notify';
import { loadSettings } from './services/settings';
import { dbPing, recordStatus } from './services/system';

const app = createApp();

/** /img/<hash>: conteúdo nunca muda para o mesmo endereço → cache de 1 ano no navegador e na borda. */
async function serveImage(req: Request, env: Env, ctx: ExecutionContext, id: string): Promise<Response> {
  if (!/^[a-f0-9]{24}$/.test(id)) return new Response('Não encontrado', { status: 404 });
  const cache = (caches as unknown as { default: Cache }).default;
  const hit = await cache.match(req);
  if (hit) return hit;
  const { sql, close } = createSql(env);
  try {
    const [img] = await sql<{ mime: string; bytes: Uint8Array }[]>`select mime, bytes from images where id = ${id}`;
    if (!img) return new Response('Não encontrado', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    const res = new Response(img.bytes as BodyInit, {
      headers: { 'Content-Type': img.mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' },
    });
    ctx.waitUntil(cache.put(req, res.clone()));
    return res;
  } finally {
    ctx.waitUntil(close().catch(() => {}));
  }
}

async function serveApp(req: Request, env: Env): Promise<Response> {
  if (!env.ASSETS) return new Response('Assets não configurados', { status: 500 });
  const url = new URL(req.url);
  const res = await env.ASSETS.fetch(req);
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('text/html')) return res;
  const admin = url.pathname === '/painel' || url.pathname.startsWith('/painel/');
  // O painel é um app instalável separado (ícone e nome próprios): o manifesto precisa vir no HTML.
  const out = new HTMLRewriter()
    .on('link[rel="manifest"]', { element: (el) => void (admin && el.setAttribute('href', '/painel.webmanifest')) })
    .on('meta[name="apple-mobile-web-app-title"]', { element: (el) => void (admin && el.setAttribute('content', 'Painel Outside')) })
    .on('link[rel="apple-touch-icon"]', { element: (el) => void (admin && el.setAttribute('href', '/icons/admin-apple-touch-icon.png')) })
    .on('title', { element: (el) => void (admin && el.setInnerContent('Painel · Outside Surf School')) })
    .on('meta[property="og:image"]', { element: (el) => void el.setAttribute('content', `${url.origin}/icons/og.png`) })
    .on('meta[property="og:url"]', { element: (el) => void el.setAttribute('content', `${url.origin}${admin ? '/' : url.pathname}`) })
    .transform(res);
  const headers = new Headers(out.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  headers.set('Content-Security-Policy', CSP);
  headers.set('Cache-Control', 'no-cache');
  if (admin) headers.set('X-Robots-Tag', 'noindex, nofollow');
  return new Response(out.body, { status: out.status, headers });
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (pathname.startsWith('/api/') || pathname.startsWith('/health')) return app.fetch(req, env, ctx);
    const m = /^\/img\/([a-f0-9]{24})$/.exec(pathname);
    if (m && req.method === 'GET') return serveImage(req, env, ctx, m[1]);
    return serveApp(req, env);
  },

  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const { sql, close } = createSql(env);
    const job = event.cron === '*/15 * * * *' ? 'reminders' : event.cron === '0 */3 * * *' ? 'forecast' : 'cleanup';
    try {
      if (job === 'reminders') {
        // Leitura real a cada 15 min: o Supabase gratuito não pausa por inatividade.
        const ms = await dbPing(sql);
        await expireHolds(sql);
        await runReminders(sql, env, await loadSettings(sql));
        await recordStatus(sql, 'cron_db', true, `Leitura OK em ${ms} ms`);
      } else if (job === 'forecast') {
        const r = await refreshForecasts(sql, env);
        await recordStatus(sql, 'forecast', r.failed.length === 0, r.failed.length ? `Falhou: ${r.failed.join(', ')}` : `OK: ${r.ok.join(', ')}`);
      } else {
        await sql`delete from rate_limits where window_start < now() - interval '2 days'`;
        await sql`delete from admin_sessions where expires_at < now()`;
        await sql`delete from student_sessions where expires_at < now()`;
        await sql`delete from push_log where sent_at < now() - interval '30 days'`;
        await sql`delete from inbox where created_at < now() - interval '120 days'`;
        await sql`delete from audit_log where created_at < now() - interval '400 days'`;
        await deleteUnusedImages(sql);
      }
    } catch (e) {
      console.error(JSON.stringify({ level: 'error', job, message: e instanceof Error ? e.message : String(e) }));
      try {
        await recordStatus(sql, job === 'forecast' ? 'forecast' : 'cron_db', false, 'Falha na tarefa agendada');
      } catch {
        /* banco fora do ar: o painel mostra a última verificação como desatualizada */
      }
    } finally {
      ctx.waitUntil(close().catch(() => {}));
    }
  },
} satisfies ExportedHandler<Env>;
