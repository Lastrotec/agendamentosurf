// Cache na borda da Cloudflare (Cache API) para respostas públicas iguais para todos:
// configuração, previsão do mar e imagens. Cada acerto poupa uma ida ao banco.
import type { Ctx } from '../types';

const cacheApi = () => (typeof caches !== 'undefined' && 'default' in caches ? (caches as unknown as { default: Cache }).default : null);

export async function cachedResponse(c: Ctx, key: string, maxAge: number, produce: () => Promise<Response>): Promise<Response> {
  const cache = c.env.TEST_SQL ? null : cacheApi();
  const req = new Request(new URL(key, c.req.url).toString());
  if (cache) {
    const hit = await cache.match(req);
    if (hit) return hit;
  }
  const res = await produce();
  if (res.ok) {
    res.headers.set('Cache-Control', `public, max-age=${maxAge}`);
    if (cache) {
      const copy = res.clone();
      try {
        c.executionCtx.waitUntil(cache.put(req, copy));
      } catch {
        await cache.put(req, copy);
      }
    }
  }
  return res;
}

/** Depois de uma alteração no painel: limpa o cache local desta borda (as outras expiram sozinhas em segundos). */
export async function purge(c: Ctx, keys: string[]) {
  const cache = c.env.TEST_SQL ? null : cacheApi();
  if (!cache) return;
  await Promise.all(keys.map((k) => cache.delete(new Request(new URL(k, c.req.url).toString())).catch(() => false)));
}
