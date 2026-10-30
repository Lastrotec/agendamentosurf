// Roteador mínimo baseado na History API (evita dependência extra no bundle público).
import { type AnchorHTMLAttributes, type MouseEvent, useEffect, useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
if (typeof window !== 'undefined') window.addEventListener('popstate', notify);

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function navigate(to: string, opts: { replace?: boolean; scroll?: boolean } = {}) {
  if (to === location.pathname + location.search + location.hash) return;
  if (opts.replace) history.replaceState(null, '', to);
  else history.pushState(null, '', to);
  notify();
  if (opts.scroll !== false) window.scrollTo({ top: 0 });
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => location.pathname, () => '/');
}

export function useSearch(): URLSearchParams {
  const s = useSyncExternalStore(subscribe, () => location.search, () => '');
  return new URLSearchParams(s);
}

export function useHash(): string {
  const h = useSyncExternalStore(
    (l) => {
      window.addEventListener('hashchange', l);
      const un = subscribe(l);
      return () => {
        window.removeEventListener('hashchange', l);
        un();
      };
    },
    () => location.hash,
    () => '',
  );
  return h;
}

export function Link({ to, onClick, replace, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; replace?: boolean }) {
  return (
    <a
      href={to}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(to, { replace });
      }}
      {...rest}
    />
  );
}

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Outside Surf School` : 'Outside Surf School · Aulas de surf em Salvador';
  }, [title]);
}
