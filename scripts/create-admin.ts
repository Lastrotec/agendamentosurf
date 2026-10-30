// Cria/atualiza o acesso do administrador. Uso:
//   DATABASE_URL=... npm run admin:create -- --email romario@exemplo.com --name "Romário de Jesus"
// A senha é pedida no terminal (não fica no histórico do shell).
import { createInterface } from 'node:readline';

import postgres from 'postgres';

import { createAdmin } from '../src/worker/services/auth';

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function ask(q: string): Promise<string> {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, (a) => (rl.close(), r(a))));
}

const url = process.env.DATABASE_URL;
const email = arg('email');
const name = arg('name') ?? 'Romário de Jesus';
if (!url || !email) {
  console.error('Uso: DATABASE_URL=... npm run admin:create -- --email EMAIL [--name NOME]');
  process.exit(1);
}
const password = await ask('Senha (mín. 12 caracteres, letras e números): ');
if (password.length < 12 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
  console.error('Senha fraca: use pelo menos 12 caracteres com letras e números.');
  process.exit(1);
}
const sql = postgres(url, { max: 1 });
await createAdmin(sql, email, name, password);
await sql.end();
console.log(`✔ Administrador ${email} pronto. Ative a verificação em duas etapas no primeiro acesso.`);
