// Cliente HTTP: JSON, cabeçalho anti-CSRF, mensagens de erro em pt-BR, sem cache.

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const method = init.method ?? (init.body !== undefined ? 'POST' : 'GET');
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: init.signal,
      headers: {
        Accept: 'application/json',
        ...(method !== 'GET' ? { 'X-Requested-With': 'outside' } : {}),
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'Sem conexão com a internet. Verifique sua rede e tente novamente.', 'NETWORK');
  }
  const type = res.headers.get('content-type') ?? '';
  const data = type.includes('application/json') ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; code?: string; details?: unknown };
    throw new ApiError(res.status, d.error ?? 'Não foi possível concluir. Tente novamente.', d.code ?? 'ERROR', d.details);
  }
  // Qualquer alteração deixa os dados em memória "velhos": continuam aparecendo na hora, mas são buscados de novo.
  if (method !== 'GET') for (const e of memo.values()) e.at = 0;
  return data as T;
}

// --- Memória de leituras (GET) da sessão: telas abrem na hora com o último dado e atualizam em segundo plano ---
const memo = new Map<string, { at: number; data?: unknown; pending?: Promise<unknown> }>();
const JUST_FETCHED_MS = 5_000;

export function peekApi<T>(path: string): T | undefined {
  return memo.get(path)?.data as T | undefined;
}

/** GET com memória: reaproveita uma busca em andamento ou muito recente; `force` sempre vai à rede. */
export function cachedGet<T>(path: string, force = false): Promise<T> {
  const e = memo.get(path);
  if (!force && e?.pending) return e.pending as Promise<T>;
  if (!force && e && e.data !== undefined && Date.now() - e.at < JUST_FETCHED_MS) return Promise.resolve(e.data as T);
  const pending = api<T>(path).then(
    (data) => {
      memo.set(path, { at: Date.now(), data });
      return data;
    },
    (err) => {
      const cur = memo.get(path);
      if (cur?.pending === pending) memo.set(path, { at: 0, data: cur.data });
      throw err;
    },
  );
  memo.set(path, { at: e?.at ?? 0, data: e?.data, pending });
  return pending;
}

/** Pré-carrega leituras em paralelo (ex.: todas as telas do painel logo na abertura). */
export function prefetchApi(paths: string[]): void {
  for (const p of paths) cachedGet(p).catch(() => {});
}

export function clearApiMemo(): void {
  memo.clear();
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Algo deu errado.');

export function newIdempotencyKey(): string {
  const b = new Uint8Array(18);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
