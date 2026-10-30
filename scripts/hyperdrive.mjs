// Garante o Hyperdrive "outside-db" (conexão do Worker com o Supabase) e grava o id no wrangler.jsonc.
// Uso no CI: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID (opcional) e DB_URL.
import { readFileSync, writeFileSync } from 'node:fs';

const token = process.env.CLOUDFLARE_API_TOKEN;
const dbUrl = process.env.DB_URL;
if (!token || !dbUrl) throw new Error('Faltam CLOUDFLARE_API_TOKEN ou DB_URL.');
const NAME = 'outside-db';

async function cf(path, init = {}) {
  const r = await fetch(`https://api.cloudflare.com/client/v4${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
  const j = await r.json();
  if (!j.success) throw new Error(`${path}: ${JSON.stringify(j.errors)}`);
  return j.result;
}

const account = process.env.CLOUDFLARE_ACCOUNT_ID || (await cf('/accounts'))[0]?.id;
if (!account) throw new Error('Conta da Cloudflare não encontrada para este token.');
const u = new URL(dbUrl);
const origin = {
  scheme: 'postgres',
  host: u.hostname,
  port: Number(u.port || 5432),
  database: u.pathname.slice(1) || 'postgres',
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
};
const list = await cf(`/accounts/${account}/hyperdrive/configs`);
let cfg = list.find((c) => c.name === NAME);
if (cfg) cfg = await cf(`/accounts/${account}/hyperdrive/configs/${cfg.id}`, { method: 'PUT', body: JSON.stringify({ name: NAME, origin }) });
else cfg = await cf(`/accounts/${account}/hyperdrive/configs`, { method: 'POST', body: JSON.stringify({ name: NAME, origin }) });
console.log(`Hyperdrive ${NAME}: ${cfg.id}`);

const path = 'wrangler.jsonc';
const src = readFileSync(path, 'utf8');
const out = src.replace(/\/\/ "hyperdrive": \[\{ "binding": "HYPERDRIVE", "id": "COLE_O_ID_AQUI" \}\],/, `"hyperdrive": [{ "binding": "HYPERDRIVE", "id": "${cfg.id}" }],`);
if (out === src) throw new Error('Linha do hyperdrive não encontrada no wrangler.jsonc.');
writeFileSync(path, out);
