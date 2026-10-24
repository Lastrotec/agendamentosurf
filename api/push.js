'use strict';
// Web Push sem dependências (RFC 8291 + VAPID / RFC 8292) para a Vercel.
//
// Variáveis de ambiente:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  -> gere com: node scripts/gerar-vapid.js
//   VAPID_SUBJECT                        -> ex.: mailto:contato@suaescola.com.br
//   KV_REST_API_URL + KV_REST_API_TOKEN  -> (opcional) Upstash/Vercel KV para guardar
//   (ou UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)  os aparelhos do instrutor
//
// GET  /api/push                                   -> { enabled, publicKey, storage }
// POST /api/push { action:'subscribe', subscription }
// POST /api/push { action:'unsubscribe', subscription }
// POST /api/push { action:'notify', title, body, url, tag, subscription? }
const crypto = require('crypto');

const b64url = buf => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const SET_KEY = 'outside:push:admin';

function vapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY, privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT || 'mailto:contato@outsidesurf.com.br' };
}

function vapidHeader(endpoint, vapid) {
  const pub = unb64url(vapid.publicKey);
  const key = crypto.createPrivateKey({
    key: { kty: 'EC', crv: 'P-256', d: vapid.privateKey, x: b64url(pub.subarray(1, 33)), y: b64url(pub.subarray(33, 65)) },
    format: 'jwk',
  });
  const header = b64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64url(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: vapid.subject }));
  const signature = crypto.sign('sha256', Buffer.from(`${header}.${claims}`), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${header}.${claims}.${b64url(signature)}, k=${vapid.publicKey}`;
}

// Criptografia aes128gcm do payload (RFC 8291).
function encrypt(subscription, payload, salt = crypto.randomBytes(16)) {
  const uaPublic = unb64url(subscription.keys.p256dh), authSecret = unb64url(subscription.keys.auth);
  const ecdh = crypto.createECDH('prime256v1');
  const asPublic = ecdh.generateKeys();
  const shared = ecdh.computeSecret(uaPublic);
  const prkKey = hmac(authSecret, shared);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01', 'binary')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01', 'binary')).subarray(0, 12);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

async function sendPush(subscription, payload, vapid) {
  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: vapidHeader(subscription.endpoint, vapid),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'high',
    },
    body: encrypt(subscription, payload),
  });
  return res.status;
}

// Armazenamento opcional via REST do Upstash/Vercel KV.
function kv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return async (...command) => {
    const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command) });
    if (!res.ok) throw new Error('KV ' + res.status);
    return (await res.json()).result;
  };
}

const validSubscription = s => s && typeof s.endpoint === 'string' && /^https:\/\//.test(s.endpoint) && s.keys && typeof s.keys.p256dh === 'string' && typeof s.keys.auth === 'string';
const clip = (s, n) => String(s || '').slice(0, n);

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString() || '{}');
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const vapid = vapidConfig(), store = kv();
  if (req.method === 'GET') return res.status(200).json({ enabled: !!vapid, publicKey: vapid ? vapid.publicKey : null, storage: !!store });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não suportado' });
  if (!vapid) return res.status(503).json({ error: 'Push não configurado no servidor (VAPID).' });

  let body;
  try { body = await readBody(req); } catch { return res.status(400).json({ error: 'JSON inválido' }); }
  const { action, subscription } = body;

  if (action === 'subscribe' || action === 'unsubscribe') {
    if (!validSubscription(subscription)) return res.status(400).json({ error: 'Inscrição inválida' });
    if (!store) return res.status(200).json({ stored: false });
    await store(action === 'subscribe' ? 'SADD' : 'SREM', SET_KEY, JSON.stringify({ endpoint: subscription.endpoint, keys: subscription.keys }));
    return res.status(200).json({ stored: true });
  }

  if (action === 'notify') {
    const targets = new Map();
    if (store) {
      for (const raw of (await store('SMEMBERS', SET_KEY)) || []) {
        try { const s = JSON.parse(raw); targets.set(s.endpoint, { sub: s, raw }); } catch { /* ignora registro inválido */ }
      }
    }
    if (validSubscription(subscription)) targets.set(subscription.endpoint, { sub: subscription });
    const payload = JSON.stringify({ title: clip(body.title, 120) || 'Outside Surf School', body: clip(body.body, 400), url: clip(body.url, 200) || './', tag: clip(body.tag, 60) || 'outside' });
    let sent = 0, failed = 0;
    await Promise.all([...targets.values()].map(async ({ sub, raw }) => {
      try {
        const status = await sendPush(sub, payload, vapid);
        if (status >= 200 && status < 300) sent++;
        else { failed++; if ((status === 404 || status === 410) && raw && store) await store('SREM', SET_KEY, raw); }
      } catch { failed++; }
    }));
    return res.status(200).json({ sent, failed, targets: targets.size });
  }

  return res.status(400).json({ error: 'Ação desconhecida' });
}

module.exports = handler;
module.exports.encrypt = encrypt;
module.exports.vapidHeader = vapidHeader;
