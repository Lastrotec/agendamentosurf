// Autenticação do administrador: senha (PBKDF2) + TOTP opcional/obrigatório, sessões opacas em cookie HttpOnly.

import type { Sql } from 'postgres';

import { audit } from '../lib/audit';
import { decryptSecret, DUMMY_PASSWORD_HASH, encryptSecret, hashPassword, randomToken, sha256Hex, verifyPassword } from '../lib/crypto';
import { badRequest, unauthorized } from '../lib/errors';
import { rateLimit } from '../lib/ratelimit';
import { generateTotpSecret, otpauthUri, verifyTotp } from '../lib/totp';

export const ADMIN_COOKIE = '__Host-os_admin';
export const SESSION_DAYS = 14;
const MAX_FAILED = 8;
const LOCK_MINUTES = 15;

interface AdminRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  totp_secret_enc: string | null;
  totp_enabled: boolean;
  totp_last_step: string | null;
  failed_attempts: number;
  locked_until: Date | null;
}

export async function login(sql: Sql, ipKey: string, email: string, password: string) {
  await rateLimit(sql, `login:ip:${ipKey}`, 20, 900);
  await rateLimit(sql, `login:email:${await sha256Hex(email)}`, 10, 900);
  const [a] = await sql<AdminRow[]>`select * from admins where email = ${email}`;
  // Sempre executa o hash para não revelar se o e-mail existe pelo tempo de resposta.
  const ok = await verifyPassword(password, a?.password_hash ?? DUMMY_PASSWORD_HASH);
  const generic = unauthorized('E-mail ou senha incorretos.', 'INVALID_CREDENTIALS');
  if (!a) throw generic;
  if (a.locked_until && new Date(a.locked_until) > new Date()) {
    throw unauthorized('Conta temporariamente bloqueada por tentativas incorretas. Tente novamente em alguns minutos.', 'LOCKED');
  }
  if (!ok) {
    const failed = a.failed_attempts + 1;
    await sql`
      update admins set failed_attempts = ${failed >= MAX_FAILED ? 0 : failed},
        locked_until = ${failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60000) : null}
      where id = ${a.id}`;
    await audit(sql, { actorType: 'ADMIN', actorId: a.id, action: 'LOGIN_FAILED', entity: 'admin', entityId: a.id });
    throw generic;
  }
  await sql`update admins set failed_attempts = 0, locked_until = null where id = ${a.id}`;
  const token = randomToken();
  await sql`
    insert into admin_sessions (admin_id, token_hash, mfa_passed, expires_at)
    values (${a.id}, ${await sha256Hex(token)}, ${!a.totp_enabled}, now() + make_interval(days => ${SESSION_DAYS}))`;
  await sql`delete from admin_sessions where admin_id = ${a.id} and expires_at < now()`;
  await audit(sql, { actorType: 'ADMIN', actorId: a.id, action: 'LOGIN', entity: 'admin', entityId: a.id });
  return { token, mfaRequired: a.totp_enabled };
}

export interface SessionInfo {
  sessionId: string;
  mfaPassed: boolean;
  admin: { id: string; email: string; name: string; totpEnabled: boolean };
}

export async function getSession(sql: Sql, token: string | undefined): Promise<SessionInfo | null> {
  if (!token || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const [r] = await sql<(AdminRow & { session_id: string; mfa_passed: boolean; last_seen_at: Date })[]>`
    select a.*, s.id as session_id, s.mfa_passed, s.last_seen_at from admin_sessions s join admins a on a.id = s.admin_id
    where s.token_hash = ${await sha256Hex(token)} and s.expires_at > now()`;
  if (!r) return null;
  // Atualiza "visto por último" no máximo a cada 10 min (evita escrita a cada requisição).
  if (Date.now() - new Date(r.last_seen_at).getTime() > 600_000) {
    await sql`update admin_sessions set last_seen_at = now() where id = ${r.session_id}`;
  }
  return {
    sessionId: r.session_id,
    mfaPassed: r.mfa_passed,
    admin: { id: r.id, email: r.email, name: r.name, totpEnabled: r.totp_enabled },
  };
}

export async function logout(sql: Sql, sessionId: string) {
  await sql`delete from admin_sessions where id = ${sessionId}`;
}

async function loadAdmin(sql: Sql, id: string) {
  const [a] = await sql<AdminRow[]>`select * from admins where id = ${id}`;
  if (!a) throw unauthorized();
  return a;
}

export async function verifyMfaForSession(sql: Sql, sessionId: string, adminId: string, code: string, encKey: string, ipKey: string) {
  await rateLimit(sql, `mfa:${adminId}`, 8, 900);
  await rateLimit(sql, `mfa:ip:${ipKey}`, 20, 900);
  const a = await loadAdmin(sql, adminId);
  if (!a.totp_enabled || !a.totp_secret_enc) throw badRequest('Verificação em duas etapas não está ativa.');
  const secret = await decryptSecret(a.totp_secret_enc, encKey);
  const step = await verifyTotp(secret, code, a.totp_last_step ? Number(a.totp_last_step) : null);
  if (step === null) {
    await audit(sql, { actorType: 'ADMIN', actorId: a.id, action: 'MFA_FAILED', entity: 'admin', entityId: a.id });
    throw unauthorized('Código inválido.', 'INVALID_CODE');
  }
  await sql`update admins set totp_last_step = ${step} where id = ${a.id}`;
  await sql`update admin_sessions set mfa_passed = true where id = ${sessionId}`;
}

export async function beginMfaSetup(sql: Sql, adminId: string, encKey: string) {
  const a = await loadAdmin(sql, adminId);
  if (a.totp_enabled) throw badRequest('A verificação em duas etapas já está ativa.');
  const secret = generateTotpSecret();
  await sql`update admins set totp_secret_enc = ${await encryptSecret(secret, encKey)}, updated_at = now() where id = ${a.id}`;
  return { secret, uri: otpauthUri(secret, a.email) };
}

export async function enableMfa(sql: Sql, sessionId: string, adminId: string, code: string, encKey: string) {
  await rateLimit(sql, `mfa:${adminId}`, 8, 900);
  const a = await loadAdmin(sql, adminId);
  if (!a.totp_secret_enc) throw badRequest('Inicie a configuração primeiro.');
  const step = await verifyTotp(await decryptSecret(a.totp_secret_enc, encKey), code, null);
  if (step === null) throw badRequest('Código inválido. Confira o horário do celular e tente de novo.', 'INVALID_CODE');
  await sql`update admins set totp_enabled = true, totp_last_step = ${step}, updated_at = now() where id = ${a.id}`;
  // Outras sessões precisam passar pelo 2º fator.
  await sql`update admin_sessions set mfa_passed = (id = ${sessionId}) where admin_id = ${a.id}`;
  await audit(sql, { actorType: 'ADMIN', actorId: a.id, action: 'MFA_ENABLED', entity: 'admin', entityId: a.id });
}

export async function disableMfa(sql: Sql, adminId: string, password: string, code: string, encKey: string) {
  await rateLimit(sql, `mfa:${adminId}`, 8, 900);
  const a = await loadAdmin(sql, adminId);
  if (!a.totp_enabled || !a.totp_secret_enc) throw badRequest('Verificação em duas etapas não está ativa.');
  if (!(await verifyPassword(password, a.password_hash))) throw unauthorized('Senha incorreta.', 'INVALID_CREDENTIALS');
  if ((await verifyTotp(await decryptSecret(a.totp_secret_enc, encKey), code, a.totp_last_step ? Number(a.totp_last_step) : null)) === null) {
    throw unauthorized('Código inválido.', 'INVALID_CODE');
  }
  await sql`update admins set totp_enabled = false, totp_secret_enc = null, totp_last_step = null, updated_at = now() where id = ${a.id}`;
  await audit(sql, { actorType: 'ADMIN', actorId: a.id, action: 'MFA_DISABLED', entity: 'admin', entityId: a.id });
}

export async function changePassword(sql: Sql, sessionId: string, adminId: string, current: string, next: string) {
  await rateLimit(sql, `pwd:${adminId}`, 5, 900);
  const a = await loadAdmin(sql, adminId);
  if (!(await verifyPassword(current, a.password_hash))) throw unauthorized('Senha atual incorreta.', 'INVALID_CREDENTIALS');
  await sql`update admins set password_hash = ${await hashPassword(next)}, updated_at = now() where id = ${a.id}`;
  await sql`delete from admin_sessions where admin_id = ${a.id} and id <> ${sessionId}`;
  await audit(sql, { actorType: 'ADMIN', actorId: a.id, action: 'PASSWORD_CHANGED', entity: 'admin', entityId: a.id });
}

export async function createAdmin(sql: Sql, email: string, name: string, password: string) {
  const [a] = await sql<{ id: string }[]>`
    insert into admins (email, name, password_hash) values (${email.toLowerCase()}, ${name}, ${await hashPassword(password)})
    on conflict (email) do update set password_hash = excluded.password_hash, name = excluded.name, updated_at = now()
    returning id`;
  return a.id;
}
