// Cadastro e acesso do aluno: nome + celular + senha. Sem e-mail e sem SMS (custo zero).
// "Esqueci a senha": o Romário gera no painel um código de 6 dígitos (válido 24 h) e manda pelo WhatsApp.
import type { Sql } from 'postgres';

import { normalizeBrazilPhone } from '../../shared/phone';
import { audit } from '../lib/audit';
import { DUMMY_PASSWORD_HASH, hashPassword, randomDigits, randomToken, sha256Hex, verifyPassword } from '../lib/crypto';
import { badRequest, conflict, notFound, unauthorized } from '../lib/errors';
import { rateLimit } from '../lib/ratelimit';

export const STUDENT_COOKIE = '__Host-os_aluno';
export const STUDENT_SESSION_DAYS = 180; // sessão longa: menos logins (e menos CPU no plano gratuito)
const MAX_FAILED = 8;
const LOCK_MINUTES = 15;
const WEAK = ['123456', '1234567', '12345678', '654321', 'senha123', 'abc123', '000000', '111111', 'qwerty'];

export function validatePassword(pw: string) {
  if (pw.length < 6) throw badRequest('A senha precisa ter pelo menos 6 caracteres.', 'WEAK_PASSWORD');
  if (pw.length > 200) throw badRequest('Senha muito longa.');
  if (/^(\d)\1+$/.test(pw) || WEAK.includes(pw.toLowerCase())) throw badRequest('Senha muito fácil. Escolha outra.', 'WEAK_PASSWORD');
}

function phoneOrThrow(input: string): string {
  const p = normalizeBrazilPhone(input, { requireMobile: true });
  if (!p.ok) throw badRequest(p.error, 'INVALID_PHONE');
  return p.e164;
}

const firstNameKey = (name: string) =>
  (name.trim().split(/\s+/)[0] ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

async function openSession(sql: Sql, studentId: string) {
  const token = randomToken();
  await sql`
    insert into student_sessions (student_id, token_hash, expires_at)
    values (${studentId}, ${await sha256Hex(token)}, now() + make_interval(days => ${STUDENT_SESSION_DAYS}))`;
  await sql`update students set last_seen_at = now() where id = ${studentId}`;
  return { token, maxAge: STUDENT_SESSION_DAYS * 86400 };
}

export async function signup(sql: Sql, ipKey: string, input: { name: string; phone: string; password: string }) {
  const phone = phoneOrThrow(input.phone);
  validatePassword(input.password);
  await rateLimit(sql, `signup:ip:${ipKey}`, 6, 3600);
  const [existing] = await sql<{ id: string; name: string; password_hash: string | null }[]>`
    select id, name, password_hash from students where phone = ${phone} and anonymized_at is null`;
  const hash = await hashPassword(input.password);
  let id: string;
  if (existing) {
    // Número já cadastrado com senha: entrar ou pedir um código ao Romário.
    if (existing.password_hash) throw conflict('Este celular já tem cadastro. Entre com a sua senha.', 'PHONE_EXISTS');
    // Cadastro feito pelo Romário (sem senha): só assume quem informa o mesmo primeiro nome.
    if (firstNameKey(existing.name) !== firstNameKey(input.name)) {
      throw conflict('Este celular já está cadastrado na escola. Fale com o instrutor para liberar o acesso.', 'PHONE_EXISTS');
    }
    const [u] = await sql<{ id: string }[]>`
      update students set password_hash = ${hash}, consent_at = now() where id = ${existing.id} and password_hash is null returning id`;
    if (!u) throw conflict('Este celular já tem cadastro. Entre com a sua senha.', 'PHONE_EXISTS');
    id = u.id;
  } else {
    const [s] = await sql<{ id: string }[]>`
      insert into students (name, phone, password_hash, consent_at) values (${input.name}, ${phone}, ${hash}, now())
      on conflict (phone) do nothing returning id`;
    if (!s) throw conflict('Este celular já tem cadastro. Entre com a sua senha.', 'PHONE_EXISTS');
    id = s.id;
  }
  await audit(sql, { actorType: 'STUDENT', actorId: id, action: 'SIGNUP', entity: 'student', entityId: id });
  return { id, ...(await openSession(sql, id)) };
}

export async function login(sql: Sql, ipKey: string, phoneInput: string, password: string) {
  const phone = phoneOrThrow(phoneInput);
  await rateLimit(sql, `slogin:ip:${ipKey}`, 20, 900);
  await rateLimit(sql, `slogin:phone:${await sha256Hex(phone)}`, 10, 900);
  const [s] = await sql<{ id: string; password_hash: string | null; failed_attempts: number; locked_until: Date | null }[]>`
    select id, password_hash, failed_attempts, locked_until from students where phone = ${phone} and anonymized_at is null`;
  // Sempre calcula o hash: o tempo de resposta não revela se o número existe.
  const ok = await verifyPassword(password, s?.password_hash ?? DUMMY_PASSWORD_HASH);
  const generic = unauthorized('Celular ou senha incorretos.', 'INVALID_CREDENTIALS');
  if (!s || !s.password_hash) throw generic;
  if (s.locked_until && new Date(s.locked_until) > new Date()) throw unauthorized('Muitas tentativas. Tente de novo em alguns minutos.', 'LOCKED');
  if (!ok) {
    const failed = s.failed_attempts + 1;
    await sql`
      update students set failed_attempts = ${failed >= MAX_FAILED ? 0 : failed},
        locked_until = ${failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60000) : null}
      where id = ${s.id}`;
    throw generic;
  }
  await sql`update students set failed_attempts = 0, locked_until = null where id = ${s.id}`;
  return { id: s.id, ...(await openSession(sql, s.id)) };
}

export async function sessionStudent(sql: Sql, token: string | undefined): Promise<string | null> {
  if (!token || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const [r] = await sql<{ id: string; student_id: string; last_seen_at: Date }[]>`
    select s.id, s.student_id, s.last_seen_at from student_sessions s join students st on st.id = s.student_id
    where s.token_hash = ${await sha256Hex(token)} and s.expires_at > now() and st.anonymized_at is null`;
  if (!r) return null;
  // Renova a sessão (deslizante) no máximo uma vez por dia: evita escrita a cada requisição.
  if (Date.now() - new Date(r.last_seen_at).getTime() > 86_400_000) {
    await sql`update student_sessions set last_seen_at = now(), expires_at = now() + make_interval(days => ${STUDENT_SESSION_DAYS}) where id = ${r.id}`;
    await sql`update students set last_seen_at = now() where id = ${r.student_id}`;
  }
  return r.student_id;
}

export async function logout(sql: Sql, token: string | undefined) {
  if (token) await sql`delete from student_sessions where token_hash = ${await sha256Hex(token)}`;
}

/** Troca a senha e encerra as outras sessões do aluno (mantém só este aparelho). */
export async function changePassword(sql: Sql, studentId: string, current: string, next: string, keepToken?: string) {
  await rateLimit(sql, `spwd:${studentId}`, 5, 900);
  validatePassword(next);
  const [s] = await sql<{ password_hash: string | null }[]>`select password_hash from students where id = ${studentId}`;
  if (!s?.password_hash || !(await verifyPassword(current, s.password_hash))) throw unauthorized('Senha atual incorreta.', 'INVALID_CREDENTIALS');
  await sql`update students set password_hash = ${await hashPassword(next)} where id = ${studentId}`;
  const keep = keepToken ? await sha256Hex(keepToken) : '';
  await sql`delete from student_sessions where student_id = ${studentId} and token_hash <> ${keep}`;
  await audit(sql, { actorType: 'STUDENT', actorId: studentId, action: 'PASSWORD_CHANGED', entity: 'student', entityId: studentId });
}

/** Painel: gera um código de 6 dígitos válido por 24 h para o aluno criar uma senha nova. */
export async function createResetCode(sql: Sql, studentId: string, adminId: string): Promise<string> {
  const code = randomDigits(6);
  const [s] = await sql<{ id: string }[]>`
    update students set reset_code_hash = ${await sha256Hex(`${studentId}:${code}`)}, reset_expires_at = now() + interval '24 hours',
      failed_attempts = 0, locked_until = null
    where id = ${studentId} and anonymized_at is null and phone is not null returning id`;
  if (!s) throw notFound('Aluno não encontrado.');
  await audit(sql, { actorType: 'ADMIN', actorId: adminId, action: 'STUDENT_RESET_CODE', entity: 'student', entityId: studentId });
  return code;
}

export async function resetWithCode(sql: Sql, ipKey: string, input: { phone: string; code: string; password: string }) {
  const phone = phoneOrThrow(input.phone);
  validatePassword(input.password);
  await rateLimit(sql, `sreset:ip:${ipKey}`, 10, 3600);
  await rateLimit(sql, `sreset:phone:${await sha256Hex(phone)}`, 5, 3600);
  const generic = badRequest('Código inválido ou vencido. Peça um novo ao instrutor.', 'INVALID_CODE');
  const [s] = await sql<{ id: string; reset_code_hash: string | null; reset_expires_at: Date | null }[]>`
    select id, reset_code_hash, reset_expires_at from students where phone = ${phone} and anonymized_at is null`;
  if (!s || !s.reset_code_hash || !s.reset_expires_at || new Date(s.reset_expires_at) < new Date()) throw generic;
  if ((await sha256Hex(`${s.id}:${input.code}`)) !== s.reset_code_hash) throw generic;
  await sql`
    update students set password_hash = ${await hashPassword(input.password)}, reset_code_hash = null, reset_expires_at = null,
      failed_attempts = 0, locked_until = null where id = ${s.id}`;
  await sql`delete from student_sessions where student_id = ${s.id}`;
  await audit(sql, { actorType: 'STUDENT', actorId: s.id, action: 'PASSWORD_RESET', entity: 'student', entityId: s.id });
  return { id: s.id, ...(await openSession(sql, s.id)) };
}

/** LGPD: apaga os dados pessoais e mantém só o histórico financeiro sem identificação. */
export async function anonymize(sql: Sql, studentId: string, actor: { type: 'ADMIN' | 'STUDENT'; id: string }) {
  const [live] = await sql`
    select 1 from bookings where student_id = ${studentId} and status in ('pending_payment','awaiting','confirmed') and starts_at > now() limit 1`;
  if (live) throw conflict('Há aulas marcadas. Cancele as aulas antes de apagar a conta.', 'HAS_BOOKINGS');
  await sql.begin(async (tx) => {
    await tx`update students set name = 'Aluno removido', phone = null, password_hash = null, admin_notes = '', board_id = null,
      reset_code_hash = null, reset_expires_at = null, anonymized_at = now() where id = ${studentId}`;
    await tx`update orders set companion = null where student_id = ${studentId}`;
    await tx`delete from student_sessions where student_id = ${studentId}`;
    await tx`delete from push_subscriptions where student_id = ${studentId}`;
    await tx`delete from tips where student_id = ${studentId}`;
    await tx`delete from inbox where student_id = ${studentId}`;
  });
  await audit(sql, { actorType: actor.type, actorId: actor.id, action: 'STUDENT_ANONYMIZED', entity: 'student', entityId: studentId });
}
