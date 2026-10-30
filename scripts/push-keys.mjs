// Gera o par de chaves VAPID das notificações push (JWK EC P-256) para o segredo VAPID_PRIVATE_JWK.
// Uso: npm run push:keys | npx wrangler secret put VAPID_PRIVATE_JWK
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
const { kty, crv, x, y, d } = await crypto.subtle.exportKey('jwk', kp.privateKey);
process.stdout.write(JSON.stringify({ kty, crv, x, y, d }));
