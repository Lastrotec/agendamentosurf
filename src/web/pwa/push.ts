// Notificações push no navegador: inscrição, estado e cancelamento.
// iPhone/iPad só recebem push com o app instalado na Tela de Início (iOS 16.4+).
import { api } from '../lib/api';
import { isStandalone } from './pwa';

export type PushState = 'loading' | 'unsupported' | 'ios-install' | 'unconfigured' | 'denied' | 'off' | 'on';

let keyPromise: Promise<string | null> | null = null;
function serverKey(): Promise<string | null> {
  keyPromise ??= api<{ publicKey: string | null }>('/api/public/push/key')
    .then((r) => r.publicKey)
    .catch(() => {
      keyPromise = null;
      return null;
    });
  return keyPromise;
}

function isIos() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return reg ?? null;
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

/** Pede a permissão (precisa vir de um toque) e inscreve este aparelho no serviço de push do navegador. */
export async function subscribeDevice(): Promise<PushSubscription> {
  const key = await serverKey();
  if (!key) throw new Error('As notificações ainda não foram configuradas pela barbearia.');
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permissão negada. Libere as notificações nas configurações do celular.');
  const reg = (await registration()) ?? (await navigator.serviceWorker.ready);
  let sub = await reg.pushManager.getSubscription();
  // Se a chave do servidor mudou, a inscrição antiga não funciona mais.
  if (sub && sub.options.applicationServerKey) {
    const current = new Uint8Array(sub.options.applicationServerKey);
    const wanted = keyBytes(key);
    if (current.length !== wanted.length || current.some((v, i) => v !== wanted[i])) {
      await sub.unsubscribe();
      sub = null;
    }
  }
  return sub ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
}

/** Inscreve e registra no servidor: cliente pelo link do agendamento (ou sessão do histórico), barbeiro pela sessão. */
export async function enablePush(target: { kind: 'customer'; token?: string } | { kind: 'admin' }): Promise<PushSubscription> {
  const sub = await subscribeDevice();
  const subscription = sub.toJSON();
  if (target.kind === 'admin') await api('/api/admin/push/subscribe', { body: { subscription } });
  else await api('/api/public/push/subscribe', { body: { subscription, ...(target.token ? { token: target.token } : {}) } });
  return sub;
}

/**
 * Cliente que já liberou as notificações (ex.: na primeira abertura do app, antes de agendar): assim que houver
 * um agendamento (link) ou sessão do histórico, o aparelho é ligado a ele sem perguntar de novo.
 */
export async function syncCustomerPush(token?: string): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const sub = await currentSubscription();
  if (!sub) return false;
  await api('/api/public/push/subscribe', { body: { subscription: sub.toJSON(), ...(token ? { token } : {}) } });
  return true;
}

// --- Primeira abertura do app instalado: ativar notificações ---
const GATE_KEY = (who: 'admin' | 'customer') => `tb-push-gate-${who}`;

/** Mostra a etapa obrigatória só no app instalado, uma vez, e só se ainda dá para pedir a permissão. */
export function needsPushGate(who: 'admin' | 'customer'): boolean {
  try {
    if (!isStandalone() || !pushSupported()) return false;
    if (localStorage.getItem(GATE_KEY(who))) return false;
    return Notification.permission === 'default';
  } catch {
    return false;
  }
}

export function finishPushGate(who: 'admin' | 'customer') {
  try {
    localStorage.setItem(GATE_KEY(who), String(Date.now()));
  } catch {
    /* modo privado: a etapa pode aparecer de novo, sem problema */
  }
}

export async function disablePush(kind: 'customer' | 'admin'): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await api(kind === 'admin' ? '/api/admin/push/unsubscribe' : '/api/public/push/unsubscribe', { body: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe();
}

export async function sendTestPush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) throw new Error('Ative as notificações neste aparelho primeiro.');
  await api('/api/admin/push/test', { body: { endpoint: sub.endpoint } });
}
