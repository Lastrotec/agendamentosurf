// Gera o par de chaves VAPID para as notificações push.
// Uso: node scripts/gerar-vapid.js  -> copie as linhas para as variáveis de ambiente da Vercel.
const crypto = require('crypto');
const b64url = buf => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const ecdh = crypto.createECDH('prime256v1');
ecdh.generateKeys();
console.log('VAPID_PUBLIC_KEY=' + b64url(ecdh.getPublicKey()));
console.log('VAPID_PRIVATE_KEY=' + b64url(Buffer.concat([Buffer.alloc(32), ecdh.getPrivateKey()]).subarray(-32)));
console.log('VAPID_SUBJECT=mailto:seu-email@exemplo.com');
