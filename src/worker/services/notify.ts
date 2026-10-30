// Avisos: sino dentro do app (tabela inbox) + notificação push no celular (aluno e instrutor).
// Lembretes configuráveis pelo Romário: X horas antes da aula e "hoje tem aula" de manhã.
import type { Sql } from 'postgres';

import { addDays, formatDateBR, weekdayName, weekdayOf, zonedParts, zonedToUtc } from '../../shared/time';
import type { Env } from '../env';
import { badRequest } from '../lib/errors';
import { isAllowedEndpoint, parseVapid, type PushMessage, sendPush, type VapidKeys, vapidPublicKey } from '../lib/webpush';
import type { SettingsRow } from './settings';

const TZ = 'America/Bahia';

export const vapidFromEnv = (env: Env): VapidKeys | null => parseVapid(env.VAPID_PRIVATE_JWK, env.VAPID_SUBJECT);
export function pushPublicKey(env: Env): string | null {
  const v = vapidFromEnv(env);
  return v ? vapidPublicKey(v.privateJwk) : null;
}

export interface SubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function saveSubscription(sql: Sql, owner: { studentId: string } | { adminId: string }, sub: SubscriptionInput) {
  if (!isAllowedEndpoint(sub.endpoint)) throw badRequest('Serviço de notificação não suportado.');
  const studentId = 'studentId' in owner ? owner.studentId : null;
  const adminId = 'adminId' in owner ? owner.adminId : null;
  await sql`
    insert into push_subscriptions (student_id, admin_id, endpoint, p256dh, auth)
    values (${studentId}, ${adminId}, ${sub.endpoint}, ${sub.keys.p256dh}, ${sub.keys.auth})
    on conflict (endpoint) do update set student_id = excluded.student_id, admin_id = excluded.admin_id, p256dh = excluded.p256dh, auth = excluded.auth`;
  // Limite por pessoa: os 5 aparelhos mais recentes.
  if (studentId) await sql`delete from push_subscriptions where student_id = ${studentId} and id not in (select id from push_subscriptions where student_id = ${studentId} order by created_at desc limit 5)`;
}

export async function removeSubscription(sql: Sql, endpoint: string, owner: { studentId: string } | { adminId: string }) {
  if ('studentId' in owner) await sql`delete from push_subscriptions where endpoint = ${endpoint} and student_id = ${owner.studentId}`;
  else await sql`delete from push_subscriptions where endpoint = ${endpoint} and admin_id = ${owner.adminId}`;
}

interface SubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Plano gratuito: 50 subrequisições por execução. */
const MAX_SENDS = 35;

export class Sender {
  sent = 0;
  constructor(
    private sql: Sql,
    private keys: VapidKeys,
  ) {}
  get full() {
    return this.sent >= MAX_SENDS;
  }
  async send(subs: SubRow[], msg: PushMessage, ttl: number) {
    for (const s of subs) {
      if (this.full) return;
      this.sent += 1;
      try {
        const r = await sendPush(s, msg, this.keys, ttl);
        if (r.ok) await this.sql`update push_subscriptions set last_sent_at = now() where id = ${s.id}`;
        else if (r.gone) await this.sql`delete from push_subscriptions where id = ${s.id}`;
      } catch (e) {
        console.error(JSON.stringify({ level: 'warn', job: 'push', message: e instanceof Error ? e.message : String(e) }));
      }
    }
  }
}

const adminSubs = (sql: Sql) => sql<SubRow[]>`select id, endpoint, p256dh, auth from push_subscriptions where admin_id is not null`;
const studentSubs = (sql: Sql, id: string) => sql<SubRow[]>`select id, endpoint, p256dh, auth from push_subscriptions where student_id = ${id}`;

export interface Notice {
  title: string;
  body: string;
  bookingId?: string | null;
  url?: string;
}

/** Grava o aviso no sino (na mesma requisição). */
export async function inbox(sql: Sql, to: { studentId: string } | 'admin', n: Notice) {
  await sql`insert into inbox (student_id, title, body, booking_id) values (${to === 'admin' ? null : to.studentId}, ${n.title.slice(0, 120)}, ${n.body.slice(0, 400)}, ${n.bookingId ?? null})`;
}

/** Envia o push (rodar em segundo plano, com conexão própria). */
export async function pushTo(sql: Sql, env: Env, to: { studentId: string } | 'admin', n: Notice) {
  const keys = vapidFromEnv(env);
  if (!keys) return;
  const subs = to === 'admin' ? await adminSubs(sql) : await studentSubs(sql, to.studentId);
  if (!subs.length) return;
  const url = n.url ?? (to === 'admin' ? (n.bookingId ? `/painel/aula/${n.bookingId}` : '/painel') : n.bookingId ? `/aulas/${n.bookingId}` : '/aulas');
  await new Sender(sql, keys).send(subs, { title: n.title, body: n.body, url, tag: n.bookingId ? `b-${n.bookingId}` : undefined }, 6 * 3600);
}

export function whenLabel(date: string, time: string, todayDate: string): string {
  if (date === todayDate) return `hoje às ${time}`;
  if (date === addDays(todayDate, 1)) return `amanhã às ${time}`;
  return `${weekdayName(weekdayOf(date))}, ${formatDateBR(date)} às ${time}`;
}

async function claim(sql: Sql, key: string): Promise<boolean> {
  const r = await sql`insert into push_log (key) values (${key}) on conflict do nothing returning key`;
  return r.length > 0;
}

/** Ninguém recebe lembrete de madrugada: o que cairia entre 22h e 6h sai às 21h30 da véspera. */
export function reminderMoment(startsAt: Date, hoursBefore: number): Date {
  const t = new Date(startsAt.getTime() - hoursBefore * 3600e3);
  const p = zonedParts(t, TZ);
  if (p.minutes >= 22 * 60) return zonedToUtc(p.date, '21:30', TZ);
  if (p.minutes < 6 * 60) return zonedToUtc(addDays(p.date, -1), '21:30', TZ);
  return t;
}

interface DueRow {
  id: string;
  student_id: string;
  student_name: string;
  place: string;
  date: string;
  time: string;
  starts_at: Date;
  created_at: Date;
}

const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? '';

/** Cron a cada 15 min: lembretes do aluno e do instrutor. */
export async function runReminders(sql: Sql, env: Env, s: SettingsRow, now = new Date()): Promise<number> {
  const keys = vapidFromEnv(env);
  if (!keys) return 0;
  const sender = new Sender(sql, keys);
  const local = zonedParts(now, TZ);
  const maxH = Math.max(1, ...s.remind_student_hours, ...s.remind_admin_hours);
  const rows = await sql<DueRow[]>`
    select b.id, b.student_id, st.name as student_name, p.short as place, to_char(b.date, 'YYYY-MM-DD') as date, b.time, b.starts_at, b.created_at
    from bookings b join students st on st.id = b.student_id join places p on p.id = b.place_id
    where b.status = 'confirmed' and b.starts_at > ${now} and b.starts_at <= ${now}::timestamptz + make_interval(hours => ${maxH + 10})
    order by b.starts_at limit 80`;
  const admins = await adminSubs(sql);

  /** O lembrete mais próximo da aula que já venceu (os anteriores são marcados sem enviar, p.ex. após uma pausa). */
  const due = (b: DueRow, hours: number[], who: 'a' | 's') => {
    const passed = [...hours]
      .sort((x, y) => x - y)
      .filter((h) => reminderMoment(b.starts_at, h) <= now && new Date(b.created_at) <= reminderMoment(b.starts_at, h));
    return passed.length ? { h: passed[0], skip: passed.slice(1), who } : null;
  };

  for (const b of rows) {
    if (sender.full) break;
    const label = whenLabel(b.date, b.time, local.date);
    const ds = due(b, s.remind_student_hours, 's');
    if (ds) {
      for (const h of ds.skip) await claim(sql, `r:s${h}:${b.id}`);
      if (await claim(sql, `r:s${ds.h}:${b.id}`)) {
        const subs = await studentSubs(sql, b.student_id);
        await sender.send(subs, { title: `Lembrete: aula de surf ${label.split(' às ')[0]} 🌊`, body: `${firstName(b.student_name)}, sua aula em ${b.place} é ${label}. Bora pro mar!`, url: `/aulas/${b.id}`, tag: `b-${b.id}` }, 3 * 3600);
      }
    }
    const da = admins.length ? due(b, s.remind_admin_hours, 'a') : null;
    if (da && !sender.full) {
      for (const h of da.skip) await claim(sql, `r:a${h}:${b.id}`);
      if (await claim(sql, `r:a${da.h}:${b.id}`)) {
        await sender.send(admins, { title: `Aula ${label}`, body: `${b.student_name} · ${b.place}`, url: `/painel/aula/${b.id}`, tag: `a-${b.id}` }, 3 * 3600);
      }
    }
  }

  // "Hoje tem aula": de manhã, para o aluno (aulas que começam pelo menos 1 h depois) e resumo do dia para o instrutor.
  if (s.remind_morning_at && !sender.full) {
    const [hh, mm] = s.remind_morning_at.split(':').map(Number);
    const at = hh * 60 + mm;
    if (local.minutes >= at && local.minutes < at + 180) {
      const start = zonedToUtc(local.date, '00:00', TZ);
      const end = zonedToUtc(addDays(local.date, 1), '00:00', TZ);
      const day = await sql<DueRow[]>`
        select b.id, b.student_id, st.name as student_name, p.short as place, to_char(b.date, 'YYYY-MM-DD') as date, b.time, b.starts_at, b.created_at
        from bookings b join students st on st.id = b.student_id join places p on p.id = b.place_id
        where b.status = 'confirmed' and b.starts_at >= ${start} and b.starts_at < ${end} order by b.starts_at`;
      for (const b of day) {
        if (sender.full) break;
        const mins = zonedParts(b.starts_at, TZ).minutes;
        if (mins < at + 60) continue;
        if (!(await claim(sql, `r:sday:${b.id}`))) continue;
        await sender.send(await studentSubs(sql, b.student_id), { title: 'Hoje tem aula de surf ☀️', body: `${firstName(b.student_name)}, te espero às ${b.time} em ${b.place}.`, url: `/aulas/${b.id}`, tag: `b-${b.id}` }, 4 * 3600);
      }
      if (day.length && admins.length && !sender.full && (await claim(sql, `r:aday:${local.date}`))) {
        await sender.send(admins, { title: `Hoje: ${day.length} aula${day.length > 1 ? 's' : ''}`, body: day.map((b) => `${b.time} ${firstName(b.student_name)} (${b.place})`).join(' · ').slice(0, 200), url: '/painel/agenda', tag: `day-${local.date}` }, 4 * 3600);
      }
    }
  }
  return sender.sent;
}
