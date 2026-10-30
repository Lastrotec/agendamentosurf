// Registro do Service Worker e detecção de plataforma para o tutorial de instalação.
import { useEffect, useState } from 'react';

import { safeStorage } from '../lib/hooks';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const subs = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    subs.forEach((s) => s());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    safeStorage.set('local', 'tb-installed', '1');
    subs.forEach((s) => s());
  });
}

export function registerServiceWorker(onUpdate: (apply: () => void) => void) {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      let reloaded = false;
      let requested = false;
      const reload = () => {
        if (reloaded) return;
        reloaded = true;
        location.reload();
      };
      // "Atualizar": pede para a versão nova assumir e recarrega. Se o navegador não avisar a troca
      // (acontece no app instalado do iPhone), recarrega mesmo assim em 1,5 s — o toque sempre funciona.
      const apply = (w: ServiceWorker | null | undefined) => () => {
        requested = true;
        w?.postMessage({ type: 'SKIP_WAITING' });
        setTimeout(reload, 1500);
      };
      const listen = (w: ServiceWorker | null) => {
        if (!w) return;
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) onUpdate(apply(w));
        });
      };
      if (reg.waiting && navigator.serviceWorker.controller) onUpdate(apply(reg.waiting));
      reg.addEventListener('updatefound', () => listen(reg.installing));
      // Recarrega quando uma versão nova assume — na primeira instalação, só se a pessoa pediu.
      const hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hadController || requested) reload();
      });
      // Verifica nova versão ao voltar para o app (sem polling contínuo).
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reg.update().catch(() => {}));
    } catch {
      /* SW indisponível: o site continua funcionando normalmente */
    }
  });
}

export type Platform = 'android' | 'ios-safari' | 'ios-other' | 'in-app' | 'desktop' | 'unknown';

export function detectPlatform(ua = navigator.userAgent): Platform {
  if (/Instagram|FBAN|FBAV|Line\/|TikTok|Snapchat/i.test(ua)) return 'in-app';
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document);
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua) ? 'ios-other' : 'ios-safari';
  if (/Android/i.test(ua)) return 'android';
  if (/Windows|Macintosh|Linux|CrOS/i.test(ua)) return 'desktop';
  return 'unknown';
}

export function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function useInstallPrompt() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((x) => x + 1);
    subs.add(f);
    return () => void subs.delete(f);
  }, []);
  return {
    canPrompt: !!deferred,
    async prompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
      if (!deferred) return 'unavailable';
      await deferred.prompt();
      const r = await deferred.userChoice;
      deferred = null;
      return r.outcome;
    },
  };
}

const DISMISS_KEY = 'tb-install-dismissed-at';
/** Sugestão de instalação: no máximo a cada 14 dias e nunca se já instalado. */
export function shouldSuggestInstall(): boolean {
  if (isStandalone() || safeStorage.get('local', 'tb-installed')) return false;
  const at = Number(safeStorage.get('local', DISMISS_KEY) ?? 0);
  return Date.now() - at > 14 * 86400000;
}
export function dismissInstall() {
  safeStorage.set('local', DISMISS_KEY, String(Date.now()));
}
