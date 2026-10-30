// Web Push sem dependências: VAPID (RFC 8292) + criptografia do conteúdo aes128gcm (RFC 8291), só com WebCrypto.

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string; // chave pública do navegador (base64url, ponto não comprimido de 65 bytes)
  auth: string; // segredo de autenticação (base64url, 16 bytes)
}

export interface VapidKeys {
  /** JWK EC P-256 com a parte privada (d). */
  privateJwk: JsonWebKey;
  subject: string; // mailto: ou https:
}

export type PushResult = { ok: true } | { ok: false; gone: boolean; status: number };

const enc = new TextEncoder();

export function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

export function bytesToB64url(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
}

/** Chave pública VAPID (applicationServerKey) a partir do JWK privado. */
export function vapidPublicKey(jwk: JsonWebKey): string {
  return bytesToB64url(concat(new Uint8Array([4]), b64urlToBytes(jwk.x!), b64urlToBytes(jwk.y!)));
}

export function parseVapid(json: string | undefined, subject: string | undefined): VapidKeys | null {
  if (!json) return null;
  try {
    const jwk = JSON.parse(json) as JsonWebKey;
    if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.d || !jwk.x || !jwk.y) return null;
    return { privateJwk: jwk, subject: subject || 'mailto:contato@outsidesurf.com.br' };
  } catch {
    return null;
  }
}

export async function vapidAuthorization(endpoint: string, keys: VapidKeys): Promise<string> {
  const aud = new URL(endpoint).origin;
  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = bytesToB64url(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: keys.subject })));
  const key = await crypto.subtle.importKey('jwk', { ...keys.privateJwk, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  // WebCrypto devolve a assinatura em r||s (IEEE P1363), o formato exigido pelo JWS.
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`)));
  return `vapid t=${header}.${claims}.${bytesToB64url(sig)}, k=${vapidPublicKey(keys.privateJwk)}`;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array<ArrayBuffer>> {
  // Cópias em ArrayBuffer próprio: WebCrypto não aceita visões de SharedArrayBuffer.
  const key = await crypto.subtle.importKey('raw', new Uint8Array(ikm), 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(salt), info: new Uint8Array(info) }, key, length * 8));
}

/** Criptografa o conteúdo para a inscrição (registro único aes128gcm). Exportado para os testes. */
export async function encryptPayload(sub: Pick<PushSubscriptionKeys, 'p256dh' | 'auth'>, payload: Uint8Array, salt: Uint8Array<ArrayBuffer> = crypto.getRandomValues(new Uint8Array(16))) {
  const uaPublic = b64urlToBytes(sub.p256dh);
  const authSecret = b64urlToBytes(sub.auth);
  const local = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const asPublic = new Uint8Array((await crypto.subtle.exportKey('raw', local.publicKey)) as ArrayBuffer);
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey } as Parameters<SubtleCrypto['deriveBits']>[0], local.privateKey, 256));

  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(payload, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

export interface PushMessage {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export async function sendPush(sub: PushSubscriptionKeys, msg: PushMessage, keys: VapidKeys, ttlSeconds = 3600): Promise<PushResult> {
  const body = await encryptPayload(sub, enc.encode(JSON.stringify(msg)));
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthorization(sub.endpoint, keys),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttlSeconds),
      Urgency: 'high',
    },
    body,
  });
  if (res.ok) return { ok: true };
  // 404/410: a inscrição não existe mais (app desinstalado, permissão revogada) → remover.
  return { ok: false, gone: res.status === 404 || res.status === 410, status: res.status };
}

/** Endpoints aceitos: serviços de push dos navegadores (evita usar o Worker como proxy para qualquer URL). */
const PUSH_HOSTS = [/\.googleapis\.com$/, /\.mozilla\.com$/, /\.push\.apple\.com$/, /\.notify\.windows\.com$/, /^push\.services\.mozilla\.com$/];
export function isAllowedEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && PUSH_HOSTS.some((r) => r.test(u.hostname));
  } catch {
    return false;
  }
}
