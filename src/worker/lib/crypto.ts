// Primitivas criptográficas via WebCrypto (Workers e Node 20+).

const enc = new TextEncoder();

export function bytesToB64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

/** Token opaco de 256 bits em base64url. */
export function randomToken(bytes = 32): string {
  return bytesToB64url(randomBytes(bytes));
}

/** Código numérico uniforme (sem viés de módulo). */
export function randomDigits(len: number): string {
  let out = '';
  while (out.length < len) {
    const b = randomBytes(16);
    for (const x of b) {
      if (x < 250 && out.length < len) out += String(x % 10);
    }
  }
  return out;
}

export async function sha256Hex(input: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(input)));
  return [...d].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export async function hmacSha256Hex(key: string, data: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(data)));
  return [...sig].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// --- Senhas (PBKDF2-SHA256; 100.000 iterações é o máximo aceito pelo runtime do Workers) ---
const PBKDF2_ITER = 100_000;

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await pbkdf2(password, salt, PBKDF2_ITER);
  return `pbkdf2_sha256$${PBKDF2_ITER}$${bytesToB64url(salt)}$${bytesToB64url(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, iter, salt, hash] = stored.split('$');
  if (alg !== 'pbkdf2_sha256' || !iter || !salt || !hash) return false;
  const computed = await pbkdf2(password, b64urlToBytes(salt), Number(iter));
  return timingSafeEqual(bytesToB64url(computed), hash);
}

/** Hash fixo usado quando o e-mail não existe, para equalizar o tempo de resposta. */
export const DUMMY_PASSWORD_HASH = 'pbkdf2_sha256$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

// --- AES-GCM para segredos em repouso (ex.: segredo TOTP) ---
async function aesKey(keyB64: string): Promise<CryptoKey> {
  const raw = b64urlToBytes(keyB64);
  if (raw.length !== 32) throw new Error('DATA_ENCRYPTION_KEY deve ter 32 bytes (base64url).');
  return crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(plain: string, keyB64: string): Promise<string> {
  const iv = randomBytes(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, await aesKey(keyB64), enc.encode(plain)));
  return `v1.${bytesToB64url(iv)}.${bytesToB64url(ct)}`;
}

export async function decryptSecret(payload: string, keyB64: string): Promise<string> {
  const [v, iv, ct] = payload.split('.');
  if (v !== 'v1' || !iv || !ct) throw new Error('Formato de segredo inválido.');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64urlToBytes(iv) as BufferSource }, await aesKey(keyB64), b64urlToBytes(ct) as BufferSource);
  return new TextDecoder().decode(pt);
}
