// Notificações push: inscrição deste aparelho, estado e cancelamento.
// iPhone/iPad só recebem push com o app instalado na Tela de Início (iOS 16.4+).
import { api, cachedGet } from '../lib/api';
import { isStandalone } from './pwa';

export type PushState = 'loading' | 'unsupported' | 'ios-install' | 'unconfigured' | 'denied' | 'off' | 'on';
export type Who = 'student' | 'admin';

const serverKey = () =>
  cachedGet<{ pushKey: string | null }>('/api/public/bootstrap')
    .then((r) => r.pushKey)
    .catch(() => null);

export const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration('/')) ?? null;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await registration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function readPushState(): Promise<PushState> {
  if (isIos() && !isStandalone()) return 'ios-install';
  if (!pushSupported()) return 'unsupported';
  if (!(await serverKey())) return 'unconfigured';
  if (Notification.permission === 'denied') return 'denied';
  const sub = await currentSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const b = atob(b64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64url.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

const base = (who: Who) => (who === 'admin' ? '/api/admin/push' : '/api/me/push');

/** Pede a permissão (precisa vir de um toque), inscreve o aparelho e registra no servidor. */
export async function enablePush(who: Who): Promise<void> {
  const key = await serverKey();
  if (!key) throw new Error('As notificações ainda não foram configuradas no servidor.');
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permissão negada. Libere as notificações nas configurações do celular.');
  const reg = (await registration()) ?? (await navigator.serviceWorker.ready);
  let sub = await reg.pushManager.getSubscription();
  if (sub?.options.applicationServerKey) {
    const cur = new Uint8Array(sub.options.applicationServerKey), want = keyBytes(key);
    if (cur.length !== want.length || cur.some((v, i) => v !== want[i])) {
      await sub.unsubscribe();
      sub = null;
    }
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
  await api(`${base(who)}/subscribe`, { body: { subscription: sub.toJSON() } });
}

/** Permissão já dada (ex.: outro login no mesmo aparelho): liga o aparelho à pessoa sem perguntar de novo. */
export async function syncPush(who: Who): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const sub = await currentSubscription();
  if (!sub) return false;
  await api(`${base(who)}/subscribe`, { body: { subscription: sub.toJSON() } });
  return true;
}

export async function disablePush(who: Who): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await api(`${base(who)}/unsubscribe`, { body: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe();
}

export async function sendTestPush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) throw new Error('Ative as notificações neste aparelho primeiro.');
  await api('/api/admin/push/test', { body: { endpoint: sub.endpoint } });
}
