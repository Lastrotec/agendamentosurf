'use strict';
// Notificações push do instrutor.
// - Com o servidor configurado (api/push + VAPID): Web Push real, chega mesmo com o app fechado.
// - Sem servidor (ex.: abrir localmente): notificação do sistema via service worker neste aparelho.
const Push = (() => {
  const SUB_KEY = 'outside-push-subscription', ENABLED_KEY = 'outside-push-admin';
  let serverInfo = null;

  const supported = () => 'Notification' in window && 'serviceWorker' in navigator && location.protocol !== 'file:';
  const pushSupported = () => supported() && 'PushManager' in window;
  const read = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sem storage */ } };

  async function server() {
    if (serverInfo) return serverInfo;
    try {
      const res = await fetch('api/push', { cache: 'no-store' });
      serverInfo = res.ok && (res.headers.get('content-type') || '').includes('json') ? await res.json() : { enabled: false };
    } catch { serverInfo = { enabled: false }; }
    return serverInfo;
  }

  function urlBase64ToUint8Array(base64) {
    const raw = atob((base64 + '='.repeat((4 - base64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, c => c.charCodeAt(0));
  }

  async function post(body) {
    const res = await fetch('api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('Servidor de push respondeu ' + res.status);
    return res.json();
  }

  async function status() {
    if (!supported()) return { state: 'unsupported', label: 'Este navegador não suporta notificações' };
    const permission = Notification.permission, info = await server();
    if (permission === 'denied') return { state: 'denied', label: 'Bloqueadas nas configurações do navegador', server: info.enabled };
    if (permission !== 'granted' || read(ENABLED_KEY) !== '1') return { state: 'off', label: 'Desativadas neste aparelho', server: info.enabled };
    if (info.enabled && read(SUB_KEY)) return { state: 'push', label: 'Ativas · Web Push pelo servidor', server: true, storage: info.storage };
    return { state: 'local', label: 'Ativas · modo local (sem servidor push)', server: info.enabled };
  }

  async function enable() {
    if (!supported()) throw new Error('Este navegador não suporta notificações. No iPhone, instale o app na Tela de Início (iOS 16.4+).');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Permissão de notificação negada.');
    write(ENABLED_KEY, '1');
    const info = await server();
    if (info.enabled && pushSupported()) {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(info.publicKey) });
      const json = sub.toJSON();
      write(SUB_KEY, JSON.stringify(json));
      await post({ action: 'subscribe', subscription: json }).catch(() => {});
    }
    return status();
  }

  async function disable() {
    write(ENABLED_KEY, null);
    const raw = read(SUB_KEY);
    write(SUB_KEY, null);
    if (pushSupported()) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe().catch(() => {});
    }
    if (raw) await post({ action: 'unsubscribe', subscription: JSON.parse(raw) }).catch(() => {});
    return status();
  }

  async function showLocal({ title, body, url = './', tag = 'outside' }) {
    if (!supported() || Notification.permission !== 'granted' || read(ENABLED_KEY) !== '1') return false;
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, { body, tag, icon: 'icon-192.png', badge: 'icon-192.png', data: { url }, vibrate: [120, 60, 120] });
    return true;
  }

  // Avisa o instrutor. Retorna { via: 'push'|'local'|'none' }.
  async function notifyTeacher(message) {
    const info = await server();
    if (info.enabled) {
      try {
        const raw = read(SUB_KEY);
        const result = await post({ action: 'notify', ...message, subscription: raw ? JSON.parse(raw) : undefined });
        if (result.sent > 0) return { via: 'push', ...result };
      } catch { /* cai para o modo local */ }
    }
    return { via: (await showLocal(message).catch(() => false)) ? 'local' : 'none' };
  }

  return { status, enable, disable, notifyTeacher, supported };
})();
