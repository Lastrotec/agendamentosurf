import { useCallback, useEffect, useRef, useState } from 'react';

import { cachedGet, peekApi } from './api';

export function useApi<T>(path: string | null, deps: unknown[] = []) {
  // Se a tela já foi pré-carregada, o dado aparece no primeiro quadro (sem "Carregando…").
  const [data, setData] = useState<T | null>(() => (path ? (peekApi<T>(path) ?? null) : null));
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(() => !!path && peekApi(path) === undefined);
  const [tick, setTick] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    const force = !first.current; // recarregar/mudar filtros sempre vai à rede
    first.current = false;
    const cached = peekApi<T>(path);
    if (cached !== undefined) {
      setData(cached);
      setLoading(false);
    } else setLoading(true);
    setError(null);
    cachedGet<T>(path, force && tick > 0)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive && (e as Error).name !== 'AbortError' && cached === undefined) setError(e as Error);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}

export function useReducedMotion(): boolean {
  const [r, setR] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const m = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setR(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return r;
}

export function useMounted() {
  const m = useRef(true);
  useEffect(() => () => void (m.current = false), []);
  return m;
}

/** Leitura/escrita resiliente de storage (pode falhar em modo privado). */
export const safeStorage = {
  get(kind: 'local' | 'session', key: string): string | null {
    try {
      return (kind === 'local' ? localStorage : sessionStorage).getItem(key);
    } catch {
      return null;
    }
  },
  set(kind: 'local' | 'session', key: string, value: string | null) {
    try {
      const s = kind === 'local' ? localStorage : sessionStorage;
      if (value === null) s.removeItem(key);
      else s.setItem(key, value);
    } catch {
      /* indisponível */
    }
  },
};
