// Painel do Romário. Tudo exige sessão do administrador (+ verificação em duas etapas em produção).
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';

import { IMAGE_SLOTS, LIVE_STATUSES, PLANS } from '../../shared/domain';
import { DEFAULT_PRIVACY, DEFAULT_TERMS } from '../../shared/legal';
import { formatBRL } from '../../shared/money';
import { normalizeBrazilPhone } from '../../shared/phone';
import { normalizePixKey } from '../../shared/pix';
import {
  adminLoginSchema,
  blockSchema,
  boardSchema,
  dateStr,
  dayHoursSchema,
  imageUploadSchema,
  legalSchema,
  manualBookingSchema,
  password,
  paymentSchema,
  placeSchema,
  pushSubscriptionSchema,
  reasonSchema,
  rescheduleSchema,
  settingsSchema,
  studentAdminSchema,
  textsSchema,
  tipSchema,
  totpCodeSchema,
  uuid,
} from '../../shared/schemas';
import { addDays } from '../../shared/time';
import { isProduction } from '../env';
import { audit } from '../lib/audit';
import { background } from '../lib/background';
import { purge } from '../lib/edge-cache';
import { badRequest, conflict, notFound, unauthorized, unavailable, forbidden } from '../lib/errors';
import { paramId, parseJson, parseQuery } from '../lib/http';
import { rateLimit } from '../lib/ratelimit';
import { sendPush } from '../lib/webpush';
import * as auth from '../services/auth';
import {
  availability,
  cancelByAdmin,
  createAdminBooking,
  getBooking,
  getOrder,
  markRefunded,
  moveBooking,
  recordPayment,
  selectBookings,
  selectOrders,
  setAttendance,
  today,
} from '../services/bookings';
import { refreshForecasts } from '../services/forecast';
import { saveImage } from '../services/images';
import { inbox, pushTo, removeSubscription, saveSubscription, vapidFromEnv } from '../services/notify';
import { type BoardRow, getPlace, loadPlaces, toBoard, toPlace } from '../services/settings';
import { anonymize, createResetCode } from '../services/student-auth';
import { recordStatus, systemStatus } from '../services/system';
import { bookingView, orderView } from '../services/views';
import type { AppEnv, Ctx } from '../types';

export const adminRoutes = new Hono<AppEnv>();

/** Literal de array do Postgres (valores já validados: números e HH:MM). O driver roda sem busca de tipos. */
const pgArray = (v: (string | number)[]) => `{${v.join(',')}}`;
const fmtDay = (d: string) => d.split('-').reverse().slice(0, 2).join('/');
const PUBLIC_CACHE = ['/__cache/bootstrap', '/__cache/legal'];

function encKey(c: Ctx): string {
  const k = c.env.DATA_ENCRYPTION_KEY;
  if (!k) throw unavailable('Chave de criptografia não configurada no servidor.', 'MISCONFIGURED');
  return k;
}
const mfaRequired = (c: Ctx) => c.env.REQUIRE_MFA === 'true' || (isProduction(c.env) && c.env.REQUIRE_MFA !== 'false');

// --- Acesso -------------------------------------------------------------------
adminRoutes.post('/auth/login', async (c) => {
  const { email, password: pw } = await parseJson(c, adminLoginSchema);
  const r = await auth.login(c.get('db')(), c.get('ipKey'), email, pw);
  setCookie(c, auth.ADMIN_COOKIE, r.token, { httpOnly: true, secure: true, sameSite: 'Strict', path: '/', maxAge: auth.SESSION_DAYS * 86400 });
  return c.json({ mfaRequired: r.mfaRequired });
});

adminRoutes.post('/auth/logout', async (c) => {
  const s = await auth.getSession(c.get('db')(), getCookie(c, auth.ADMIN_COOKIE));
  if (s) await auth.logout(c.get('db')(), s.sessionId);
  deleteCookie(c, auth.ADMIN_COOKIE, { path: '/', secure: true });
  return c.json({ ok: true });
});

adminRoutes.post('/auth/mfa', async (c) => {
  const { code } = await parseJson(c, totpCodeSchema);
  const s = await auth.getSession(c.get('db')(), getCookie(c, auth.ADMIN_COOKIE));
  if (!s) throw unauthorized();
  await auth.verifyMfaForSession(c.get('db')(), s.sessionId, s.admin.id, code, encKey(c), c.get('ipKey'));
  return c.json({ ok: true });
});

const MFA_SETUP_PATHS = ['/api/admin/auth/me', '/api/admin/security/mfa/setup', '/api/admin/security/mfa/enable'];

adminRoutes.use('*', async (c, next) => {
  const s = await auth.getSession(c.get('db')(), getCookie(c, auth.ADMIN_COOKIE));
  if (!s) throw unauthorized();
  if (s.admin.totpEnabled && !s.mfaPassed) throw unauthorized('Informe o código de verificação.', 'MFA_REQUIRED');
  if (!s.admin.totpEnabled && mfaRequired(c) && !MFA_SETUP_PATHS.includes(c.req.path)) {
    throw forbidden('Ative a verificação em duas etapas para continuar.', 'MFA_SETUP_REQUIRED');
  }
  c.set('admin', { id: s.admin.id, email: s.admin.email, name: s.admin.name, sessionId: s.sessionId, totpEnabled: s.admin.totpEnabled });
  await next();
});

adminRoutes.get('/auth/me', (c) => {
  const a = c.get('admin');
  return c.json({ name: a.name, email: a.email, totpEnabled: a.totpEnabled, mfaRequired: mfaRequired(c) });
});

adminRoutes.post('/security/mfa/setup', async (c) => c.json(await auth.beginMfaSetup(c.get('db')(), c.get('admin').id, encKey(c))));
adminRoutes.post('/security/mfa/enable', async (c) => {
  const { code } = await parseJson(c, totpCodeSchema);
  await auth.enableMfa(c.get('db')(), c.get('admin').sessionId, c.get('admin').id, code, encKey(c));
  return c.json({ ok: true });
});
adminRoutes.post('/security/password', async (c) => {
  const body = await parseJson(c, z.object({ current: password, next: z.string().min(12, 'Use pelo menos 12 caracteres.').max(200) }));
  if (body.next === body.current) throw badRequest('A nova senha precisa ser diferente da atual.');
  if (/^(.)\1+$/.test(body.next) || !/\p{L}/u.test(body.next) || !/\d/.test(body.next)) throw badRequest('Use letras e números na nova senha.', 'WEAK_PASSWORD');
  await auth.changePassword(c.get('db')(), c.get('admin').sessionId, c.get('admin').id, body.current, body.next);
  return c.json({ ok: true });
});

// --- Notificações deste aparelho ----------------------------------------------
adminRoutes.post('/push/subscribe', async (c) => {
  const { subscription } = await parseJson(c, z.object({ subscription: pushSubscriptionSchema }));
  await saveSubscription(c.get('db')(), { adminId: c.get('admin').id }, subscription);
  return c.json({ ok: true });
});
adminRoutes.post('/push/unsubscribe', async (c) => {
  const { endpoint } = await parseJson(c, z.object({ endpoint: z.string().url().max(1000) }));
  await removeSubscription(c.get('db')(), endpoint, { adminId: c.get('admin').id });
  return c.json({ ok: true });
});
adminRoutes.post('/push/test', async (c) => {
  const { endpoint } = await parseJson(c, z.object({ endpoint: z.string().url().max(1000) }));
  const keys = vapidFromEnv(c.env);
  if (!keys) throw unavailable('As chaves de notificação (VAPID) não foram configuradas no servidor.');
  const sql = c.get('db')();
  await rateLimit(sql, `pushtest:${c.get('admin').id}`, 10, 3600);
  const [sub] = await sql<{ endpoint: string; p256dh: string; auth: string }[]>`
    select endpoint, p256dh, auth from push_subscriptions where endpoint = ${endpoint} and admin_id = ${c.get('admin').id}`;
  if (!sub) throw notFound('Ative as notificações neste aparelho primeiro.');
  const r = await sendPush(sub, { title: 'Notificações ativas 🌊', body: 'É assim que você vai saber de cada agendamento e pagamento.', url: '/painel' }, keys, 600);
  if (!r.ok) throw unavailable('O serviço de notificação recusou o envio. Ative de novo neste aparelho.');
  return c.json({ ok: true });
});

// --- Visão geral ----------------------------------------------------------------
adminRoutes.get('/dashboard', async (c) => {
  const sql = c.get('db')();
  const s = await c.get('settings')();
  const t = today();
  const todays = await selectBookings(sql, `date = $1 and status in ('confirmed','awaiting','done','no_show') order by time`, [t]);
  const pending = await selectBookings(sql, `(status = 'awaiting' or (status = 'pending_payment' and pix_claimed_at is not null)) order by starts_at`, []);
  const upcoming = await selectBookings(sql, `status = 'confirmed' and date > $1 order by starts_at limit 6`, [t]);
  const month = t.slice(0, 7);
  const [money] = await sql<{ received: number; receivable: number; refunds: number }[]>`
    select
      coalesce((select sum(amount_cents) from payments where amount_cents > 0 and to_char(created_at at time zone 'America/Bahia', 'YYYY-MM') = ${month}), 0)::int as received,
      coalesce((select sum(total_cents - paid_cents) from orders where status in ('active') and paid_cents > 0), 0)::int as receivable,
      coalesce((select sum(refund_due_cents) from orders where refund_due_cents > 0), 0)::int as refunds`;
  const feed = await sql<{ id: string; title: string; body: string; booking_id: string | null; read_at: Date | null; created_at: Date }[]>`
    select id, title, body, booking_id, read_at, created_at from inbox where student_id is null order by created_at desc limit 8`;
  const ids = [...new Set([...todays, ...pending, ...upcoming].map((b) => b.student_id))];
  return c.json({
    today: t,
    todays: todays.map((b) => bookingView(b, s)),
    pending: pending.map((b) => bookingView(b, s)),
    upcoming: upcoming.map((b) => bookingView(b, s)),
    money,
    feed: feed.map((n) => ({ id: n.id, title: n.title, body: n.body, bookingId: n.booking_id, read: !!n.read_at, at: new Date(n.created_at).toISOString() })),
    students: await studentNames(c, ids),
  });
});

async function studentNames(c: Ctx, ids: string[]) {
  if (!ids.length) return {};
  const rows = await c.get('db')()<{ id: string; name: string; phone: string | null }[]>`select id, name, phone from students where id in ${c.get('db')()(ids)}`;
  return Object.fromEntries(rows.map((r) => [r.id, { name: r.name, phone: r.phone }]));
}

adminRoutes.get('/inbox', async (c) => {
  const rows = await c.get('db')()<{ id: string; title: string; body: string; booking_id: string | null; read_at: Date | null; created_at: Date }[]>`
    select id, title, body, booking_id, read_at, created_at from inbox where student_id is null order by created_at desc limit 60`;
  return c.json({ inbox: rows.map((n) => ({ id: n.id, title: n.title, body: n.body, bookingId: n.booking_id, read: !!n.read_at, at: new Date(n.created_at).toISOString() })) });
});
adminRoutes.post('/inbox/read', async (c) => {
  await c.get('db')()`update inbox set read_at = now() where student_id is null and read_at is null`;
  return c.json({ ok: true });
});

// --- Agenda ---------------------------------------------------------------------
adminRoutes.get('/agenda', async (c) => {
  const q = parseQuery(c, z.object({ from: dateStr, days: z.coerce.number().int().min(1).max(14).default(7) }));
  const sql = c.get('db')();
  const s = await c.get('settings')();
  const places = await loadPlaces(sql, true);
  const to = addDays(q.from, q.days - 1);
  const slots: Record<string, unknown> = {};
  // Painel vê o dia inteiro (sem antecedência mínima), para encaixar aulas.
  const adminS = { ...s, min_notice_hours: 0, horizon_days: 365 };
  for (const p of places) slots[p.id] = await availability(sql, adminS, p, q.from, q.days);
  const bookings = await selectBookings(sql, `date between $1 and $2 and status in ('pending_payment','awaiting','confirmed','done','no_show') order by date, time`, [q.from, to]);
  const live = bookings.filter((b) => b.status !== 'pending_payment' || (b.hold_until && new Date(b.hold_until) > new Date()) || b.pix_claimed_at);
  const blocks = await sql<{ id: string; place_id: string; date: string; time: string | null; reason: string }[]>`
    select id, place_id, to_char(date, 'YYYY-MM-DD') as date, time, reason from slot_blocks where date between ${q.from} and ${to}`;
  const overrides = await sql<{ place_id: string; date: string; hours: string[] }[]>`
    select place_id, to_char(date, 'YYYY-MM-DD') as date, to_json(hours) as hours from day_hours where date between ${q.from} and ${to}`;
  return c.json({
    places: places.map(toPlace),
    slots,
    bookings: live.map((b) => bookingView(b, s)),
    blocks: blocks.map((b) => ({ id: b.id, place: b.place_id, date: b.date, time: b.time, reason: b.reason })),
    overrides: overrides.map((o) => ({ place: o.place_id, date: o.date, hours: o.hours })),
    students: await studentNames(c, [...new Set(live.map((b) => b.student_id))]),
  });
});

/** Exceções futuras da agenda (bloqueios e dias com horários próprios) para a tela Horários. */
adminRoutes.get('/schedule', async (c) => {
  const sql = c.get('db')();
  const from = today();
  const blocks = await sql<{ id: string; place_id: string; date: string; time: string | null; reason: string }[]>`
    select id, place_id, to_char(date, 'YYYY-MM-DD') as date, time, reason from slot_blocks where date >= ${from} order by date, time nulls first limit 300`;
  const overrides = await sql<{ place_id: string; date: string; hours: string[] }[]>`
    select place_id, to_char(date, 'YYYY-MM-DD') as date, to_json(hours) as hours from day_hours where date >= ${from} order by date limit 300`;
  return c.json({
    today: from,
    blocks: blocks.map((b) => ({ id: b.id, place: b.place_id, date: b.date, time: b.time, reason: b.reason })),
    overrides: overrides.map((o) => ({ place: o.place_id, date: o.date, hours: o.hours })),
  });
});

adminRoutes.post('/blocks', async (c) => {
  const b = await parseJson(c, blockSchema);
  const sql = c.get('db')();
  await getPlace(sql, b.place);
  if (b.date < today()) throw badRequest('Escolha hoje ou uma data futura.');
  const [dup] = await sql<{ id: string }[]>`
    select id from slot_blocks where place_id = ${b.place} and date = ${b.date} and time is not distinct from ${b.time} limit 1`;
  if (!dup) await sql`insert into slot_blocks (place_id, date, time, reason) values (${b.place}, ${b.date}, ${b.time}, ${b.reason})`;
  await audit(sql, { actorType: 'ADMIN', actorId: c.get('admin').id, action: 'SLOT_BLOCKED', entity: 'place', entityId: b.place });
  return c.json({ ok: true }, 201);
});
adminRoutes.delete('/blocks/:id', async (c) => {
  await c.get('db')()`delete from slot_blocks where id = ${paramId(c)}`;
  return c.json({ ok: true });
});
adminRoutes.post('/day-hours', async (c) => {
  const b = await parseJson(c, dayHoursSchema);
  const sql = c.get('db')();
  const place = await getPlace(sql, b.place);
  if (b.date < today()) throw badRequest('Escolha hoje ou uma data futura.');
  if (b.hours === null) {
    // Voltar ao padrão não pode deixar aula fora da agenda (dia extra, ou horário que só existia na exceção).
    const dow = new Date(`${b.date}T12:00:00Z`).getUTCDay();
    const rows = await selectBookings(sql, `place_id = $1 and date = $2 and status in ('pending_payment','awaiting','confirmed')`, [b.place, b.date]);
    const lost = rows.find((r) => !place.weekdays.includes(dow) || (place.schedule === 'fixed' && !place.hours.includes(r.time)));
    if (lost) throw conflict(`Há uma aula às ${lost.time} que só existe nesta exceção. Remarque-a antes.`);
    await sql`delete from day_hours where place_id = ${b.place} and date = ${b.date}`;
  } else {
    if (!b.hours.length) throw badRequest('Marque pelo menos um horário ou bloqueie o dia.');
    const hours = [...new Set(b.hours)].sort();
    const conflictRows = await selectBookings(sql, `place_id = $1 and date = $2 and status in ('pending_payment','awaiting','confirmed') and not (time = any($3::text[]))`, [b.place, b.date, pgArray(hours)]);
    if (conflictRows.length) throw conflict(`Há uma aula às ${conflictRows[0].time}. Remarque-a antes de tirar este horário.`);
    await sql`insert into day_hours (place_id, date, hours) values (${b.place}, ${b.date}, ${pgArray(hours)}::text[]) on conflict (place_id, date) do update set hours = excluded.hours`;
  }
  return c.json({ ok: true });
});

// --- Aulas ---------------------------------------------------------------------
adminRoutes.get('/bookings', async (c) => {
  const q = parseQuery(c, z.object({ tab: z.enum(['pending', 'upcoming', 'past', 'cancelled', 'refunds']).default('pending') }));
  const sql = c.get('db')();
  const s = await c.get('settings')();
  const where = {
    pending: `(status = 'awaiting' or (status = 'pending_payment' and (hold_until > now() or pix_claimed_at is not null))) order by starts_at`,
    upcoming: `status = 'confirmed' and starts_at > now() order by starts_at limit 200`,
    past: `status in ('confirmed','done','no_show') and starts_at <= now() order by starts_at desc limit 200`,
    cancelled: `status in ('cancelled','declined','expired') order by updated_at desc limit 200`,
    refunds: `order_id in (select id from orders where refund_due_cents > 0) order by updated_at desc`,
  }[q.tab];
  const rows = await selectBookings(sql, where, []);
  const orders = rows.length ? await selectOrders(sql, `id = any($1::uuid[])`, [pgArray([...new Set(rows.map((b) => b.order_id))])]) : [];
  return c.json({
    bookings: rows.map((b) => bookingView(b, s)),
    orders: Object.fromEntries(orders.map((o) => [o.id, orderView(o)])),
    students: await studentNames(c, [...new Set(rows.map((b) => b.student_id))]),
  });
});

adminRoutes.get('/bookings/:id', async (c) => {
  const sql = c.get('db')();
  const s = await c.get('settings')();
  const b = await getBooking(sql, paramId(c));
  const o = await getOrder(sql, b.order_id);
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from bookings where order_id = ${o.id} and status not in ('cancelled','declined','expired')`;
  const events = await sql<{ text: string; created_at: Date }[]>`select text, created_at from booking_events where booking_id = ${b.id} order by created_at`;
  const payments = await sql<{ id: string; amount_cents: number; method: string; kind: string; note: string | null; created_at: Date }[]>`
    select id, amount_cents, method, kind, note, created_at from payments where order_id = ${o.id} order by created_at`;
  const [st] = await sql<{ id: string; name: string; phone: string | null; level: string; board_id: string | null }[]>`select id, name, phone, level, board_id from students where id = ${b.student_id}`;
  return c.json({
    booking: { ...bookingView(b, s), boardId: b.board_id },
    order: orderView(o, n),
    student: st,
    events: events.map((e) => ({ text: e.text, at: new Date(e.created_at).toISOString() })),
    payments: payments.map((p) => ({ id: p.id, amountCents: p.amount_cents, method: p.method, kind: p.kind, note: p.note, at: new Date(p.created_at).toISOString() })),
  });
});

async function tell(c: Ctx, studentId: string, title: string, body: string, bookingId: string) {
  const n = { title, body, bookingId };
  await inbox(c.get('db')(), { studentId }, n);
  background(c, (bg) => pushTo(bg, c.env, { studentId }, n));
}

adminRoutes.post('/bookings/:id/confirm', async (c) => {
  const sql = c.get('db')();
  const b = await getBooking(sql, paramId(c));
  if (b.status !== 'awaiting') throw conflict('Esta aula não está aguardando confirmação.');
  await setAttendance(sql, b.id, 'confirmed', c.get('admin').id);
  const place = await getPlace(sql, b.place_id);
  await tell(c, b.student_id, 'Aula confirmada ✅', `${(await c.get('settings')()).instructor.split(' ')[0]} confirmou sua aula de ${fmtDay(b.date)} às ${b.time} em ${place.short}.`, b.id);
  return c.json({ ok: true });
});

/** Romário conferiu o Pix (ou recebeu em dinheiro/cartão): registra e confirma a aula. */
adminRoutes.post('/orders/:id/payments', async (c) => {
  const body = await parseJson(c, paymentSchema);
  const sql = c.get('db')();
  const s = await c.get('settings')();
  const r = await recordPayment(sql, s, paramId(c), body.amountCents, body.method, { type: 'ADMIN', id: c.get('admin').id }, body.note);
  const b = r.confirmed[0];
  await tell(
    c,
    r.order.student_id,
    b ? 'Pagamento recebido · aula confirmada ✅' : 'Pagamento recebido',
    b ? `Recebemos ${formatBRL(r.amount)}. Sua aula de ${fmtDay(b.date)} às ${b.time} está confirmada. Nos vemos no mar!` : `Recebemos ${formatBRL(r.amount)} do pedido ${r.order.code}. Obrigado!`,
    b?.id ?? (await selectBookings(sql, 'order_id = $1 order by starts_at limit 1', [r.order.id]))[0]?.id,
  );
  return c.json({ ok: true, amountCents: r.amount });
});

adminRoutes.post('/orders/:id/refunded', async (c) => {
  const { method } = await parseJson(c, z.object({ method: z.enum(['pix', 'card', 'cash', 'other']).default('pix') }));
  const sql = c.get('db')();
  const r = await markRefunded(sql, paramId(c), c.get('admin').id, method);
  const [b] = await selectBookings(sql, 'order_id = $1 order by starts_at desc limit 1', [r.order.id]);
  if (b) await tell(c, r.order.student_id, 'Valor devolvido', `${formatBRL(r.amount)} do pedido ${r.order.code} foram devolvidos para você.`, b.id);
  return c.json({ ok: true });
});

adminRoutes.post('/bookings/:id/decline', async (c) => {
  const { reason } = await parseJson(c, reasonSchema);
  const sql = c.get('db')();
  const r = await cancelByAdmin(sql, paramId(c), c.get('admin').id, reason);
  const place = await getPlace(sql, r.booking.place_id);
  await tell(
    c,
    r.booking.student_id,
    r.status === 'declined' ? 'Pedido de aula recusado' : 'Aula cancelada pelo instrutor',
    `${place.short} · ${fmtDay(r.booking.date)} às ${r.booking.time}. ${reason}${r.refund ? ` O valor de ${formatBRL(r.refund)} será devolvido.` : r.order.plan !== 'single' ? ' A aula voltou como crédito no seu pacote.' : ''}`,
    r.booking.id,
  );
  return c.json({ ok: true, refundCents: r.refund });
});

adminRoutes.post('/bookings/:id/attend', async (c) => {
  const { status } = await parseJson(c, z.object({ status: z.enum(['done', 'no_show']) }));
  await setAttendance(c.get('db')(), paramId(c), status, c.get('admin').id);
  return c.json({ ok: true });
});

adminRoutes.post('/bookings/:id/move', async (c) => {
  const body = await parseJson(c, rescheduleSchema);
  const sql = c.get('db')();
  const s = await c.get('settings')();
  const b = await getBooking(sql, paramId(c));
  if (!LIVE_STATUSES.includes(b.status as never)) throw conflict('Esta aula não está ativa.');
  const { after } = await moveBooking(sql, s, b, body.date, body.time, { by: 'admin', id: c.get('admin').id });
  const place = await getPlace(sql, after.place_id);
  await tell(c, b.student_id, 'Aula remarcada', `${s.instructor.split(' ')[0]} remarcou sua aula para ${fmtDay(after.date)} às ${after.time} em ${place.short}.`, b.id);
  return c.json({ ok: true });
});

adminRoutes.post('/bookings/:id/board', async (c) => {
  const { boardId } = await parseJson(c, z.object({ boardId: uuid.nullable() }));
  const sql = c.get('db')();
  const b = await getBooking(sql, paramId(c));
  await sql`update bookings set board_id = ${boardId}, updated_at = now() where id = ${b.id}`;
  const s = await c.get('settings')();
  if (boardId && s.quiver_enabled) {
    const [board] = await sql<{ name: string; size: string }[]>`select name, size from boards where id = ${boardId}`;
    if (board) await tell(c, b.student_id, 'Sua prancha foi definida 🏄', `Para a aula de ${fmtDay(b.date)} às ${b.time}: ${board.name} ${board.size}.`, b.id);
  }
  return c.json({ ok: true });
});

adminRoutes.post('/bookings', async (c) => {
  const input = await parseJson(c, manualBookingSchema);
  const sql = c.get('db')();
  const s = await c.get('settings')();
  const b = await createAdminBooking(sql, s, c.get('admin').id, input);
  const place = await getPlace(sql, b.place_id);
  await tell(c, b.student_id, 'Aula agendada', `${s.instructor.split(' ')[0]} agendou sua aula para ${fmtDay(b.date)} às ${b.time} em ${place.short}.`, b.id);
  return c.json({ booking: bookingView(b, s) }, 201);
});

// --- Alunos -----------------------------------------------------------------------
adminRoutes.get('/students', async (c) => {
  const q = parseQuery(c, z.object({ q: z.string().max(60).optional() }));
  const sql = c.get('db')();
  const term = (q.q ?? '').trim();
  const digits = term.replace(/\D/g, '');
  const rows = await sql<{ id: string; name: string; phone: string | null; level: string; created_at: Date; lessons: number; next: Date | null; has_password: boolean }[]>`
    select s.id, s.name, s.phone, s.level, s.created_at, (s.password_hash is not null) as has_password,
      (select count(*)::int from bookings b where b.student_id = s.id and b.status = 'done') as lessons,
      (select min(starts_at) from bookings b where b.student_id = s.id and b.status = 'confirmed' and b.starts_at > now()) as next
    from students s
    where s.anonymized_at is null
      and (${term} = '' or lower(s.name) like ${'%' + term.toLowerCase() + '%'} or (${digits} <> '' and s.phone like ${'%' + digits + '%'}))
    order by lower(s.name) limit 300`;
  return c.json({ students: rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone, level: r.level, lessons: r.lessons, hasPassword: r.has_password, next: r.next ? new Date(r.next).toISOString() : null, since: new Date(r.created_at).toISOString() })) });
});

adminRoutes.get('/students/:id', async (c) => {
  const sql = c.get('db')();
  const s = await c.get('settings')();
  const id = paramId(c);
  const [st] = await sql<{ id: string; name: string; phone: string | null; level: string; board_id: string | null; admin_notes: string; created_at: Date; has_password: boolean; anonymized_at: Date | null }[]>`
    select id, name, phone, level, board_id, admin_notes, created_at, (password_hash is not null) as has_password, anonymized_at from students where id = ${id}`;
  if (!st || st.anonymized_at) throw notFound('Aluno não encontrado.');
  const bookings = await selectBookings(sql, `student_id = $1 order by starts_at desc limit 100`, [id]);
  const orders = await selectOrders(sql, `student_id = $1 and status <> 'expired' order by created_at desc`, [id]);
  const used = await sql<{ order_id: string; n: number }[]>`select order_id, count(*)::int as n from bookings where student_id = ${id} and status not in ('cancelled','declined','expired') group by order_id`;
  const usedBy = Object.fromEntries(used.map((u) => [u.order_id, u.n]));
  const tips = await sql<{ id: string; text: string; created_at: Date }[]>`select id, text, created_at from tips where student_id = ${id} order by created_at desc`;
  return c.json({
    student: { id: st.id, name: st.name, phone: st.phone, level: st.level, boardId: st.board_id, adminNotes: st.admin_notes, hasPassword: st.has_password, since: new Date(st.created_at).toISOString() },
    bookings: bookings.map((b) => ({ ...bookingView(b, s), boardId: b.board_id })),
    orders: orders.map((o) => orderView(o, usedBy[o.id] ?? 0)),
    tips: tips.map((t) => ({ id: t.id, text: t.text, at: new Date(t.created_at).toISOString() })),
  });
});

adminRoutes.put('/students/:id', async (c) => {
  const body = await parseJson(c, studentAdminSchema);
  let phone: string | null = null;
  if (body.phone) {
    const p = normalizeBrazilPhone(body.phone, { requireMobile: true });
    if (!p.ok) throw badRequest(p.error, 'INVALID_PHONE');
    phone = p.e164;
  }
  const sql = c.get('db')();
  try {
    await sql`update students set name = ${body.name}, phone = ${phone}, level = ${body.level}, board_id = ${body.boardId}, admin_notes = ${body.adminNotes} where id = ${paramId(c)} and anonymized_at is null`;
  } catch (e) {
    if ((e as { code?: string }).code === '23505') throw conflict('Outro aluno já usa este celular.');
    throw e;
  }
  return c.json({ ok: true });
});

adminRoutes.post('/students', async (c) => {
  const body = await parseJson(c, z.object({ name: studentAdminSchema.shape.name, phone: z.string().min(8).max(40) }));
  const p = normalizeBrazilPhone(body.phone, { requireMobile: true });
  if (!p.ok) throw badRequest(p.error, 'INVALID_PHONE');
  const [st] = await c.get('db')()<{ id: string }[]>`insert into students (name, phone) values (${body.name}, ${p.e164}) on conflict (phone) do nothing returning id`;
  if (!st) throw conflict('Já existe um aluno com este celular.');
  return c.json({ id: st.id }, 201);
});

adminRoutes.post('/students/:id/reset-code', async (c) => {
  const code = await createResetCode(c.get('db')(), paramId(c), c.get('admin').id);
  return c.json({ code, validHours: 24 });
});

adminRoutes.post('/students/:id/tips', async (c) => {
  const { text } = await parseJson(c, tipSchema);
  const sql = c.get('db')();
  const id = paramId(c);
  await sql`insert into tips (student_id, text) values (${id}, ${text})`;
  const n = { title: 'Nova dica do instrutor 🤙', body: text.slice(0, 140) };
  await inbox(sql, { studentId: id }, n);
  background(c, (bg) => pushTo(bg, c.env, { studentId: id }, { ...n, url: '/' }));
  return c.json({ ok: true }, 201);
});

adminRoutes.delete('/students/:id/tips/:tip', async (c) => {
  await c.get('db')()`delete from tips where id = ${paramId(c, 'tip')} and student_id = ${paramId(c)}`;
  return c.json({ ok: true });
});

adminRoutes.delete('/students/:id', async (c) => {
  await anonymize(c.get('db')(), paramId(c), { type: 'ADMIN', id: c.get('admin').id });
  return c.json({ ok: true });
});

// --- Quiver (opcional) ---------------------------------------------------------------
adminRoutes.get('/boards', async (c) => {
  const rows = await c.get('db')()<BoardRow[]>`select * from boards order by sort, created_at`;
  return c.json({ boards: rows.map(toBoard) });
});
adminRoutes.post('/boards', async (c) => {
  const b = await parseJson(c, boardSchema);
  const [r] = await c.get('db')()<{ id: string }[]>`
    insert into boards (name, size, volume, type, level, description, image_id, available, condition)
    values (${b.name}, ${b.size}, ${b.volume}, ${b.type}, ${b.level}, ${b.description}, ${b.imageId}, ${b.available && b.condition === 'ok'}, ${b.condition}) returning id`;
  await purge(c, PUBLIC_CACHE);
  return c.json({ id: r.id }, 201);
});
adminRoutes.put('/boards/:id', async (c) => {
  const b = await parseJson(c, boardSchema);
  await c.get('db')()`
    update boards set name = ${b.name}, size = ${b.size}, volume = ${b.volume}, type = ${b.type}, level = ${b.level}, description = ${b.description},
      image_id = ${b.imageId}, available = ${b.available && b.condition === 'ok'}, condition = ${b.condition} where id = ${paramId(c)}`;
  await purge(c, PUBLIC_CACHE);
  return c.json({ ok: true });
});
adminRoutes.delete('/boards/:id', async (c) => {
  await c.get('db')()`delete from boards where id = ${paramId(c)}`;
  await purge(c, PUBLIC_CACHE);
  return c.json({ ok: true });
});

// --- Locais, preços e horários ------------------------------------------------------
adminRoutes.get('/places', async (c) => {
  const rows = await loadPlaces(c.get('db')(), true);
  return c.json({ places: rows.map((p) => ({ ...toPlace(p), waveFactor: Number(p.wave_factor), active: p.active })) });
});
adminRoutes.put('/places/:id', async (c) => {
  const id = c.req.param('id');
  const p = await parseJson(c, placeSchema);
  const sql = c.get('db')();
  await getPlace(sql, id);
  if (p.schedule === 'fixed' && !p.hours.length) throw badRequest('Informe ao menos um horário de aula.');
  // Não deixa aula marcada "órfã": dia da semana tirado, horário fixo removido ou vagas abaixo do já reservado.
  // Dias com horários próprios (exceções) não dependem da semana padrão.
  const weekdays = [...new Set(p.weekdays)];
  const hours = [...new Set(p.hours)];
  const live = await sql<{ date: string; time: string; dow: number; n: number; custom: boolean }[]>`
    select to_char(b.date, 'YYYY-MM-DD') as date, b.time, extract(dow from b.date)::int as dow, sum(b.people)::int as n,
      exists (select 1 from day_hours d where d.place_id = b.place_id and d.date = b.date) as custom
    from bookings b
    where b.place_id = ${id} and b.starts_at > now() and b.status in ('pending_payment','awaiting','confirmed')
      and (b.status <> 'pending_payment' or b.hold_until > now() or b.pix_claimed_at is not null)
    group by b.place_id, b.date, b.time order by b.date, b.time`;
  for (const r of live) {
    const off = !r.custom && (!weekdays.includes(r.dow) || (p.schedule === 'fixed' && !hours.includes(r.time)));
    if (off) throw conflict(`Há aula marcada em ${fmtDay(r.date)} às ${r.time}, que ficaria fora da nova agenda. Remarque-a antes.`, 'SCHEDULE_CONFLICT');
    if (r.n > p.capacity) throw conflict(`${fmtDay(r.date)} às ${r.time} já tem ${r.n} pessoas marcadas. Use pelo menos ${r.n} vagas.`, 'SCHEDULE_CONFLICT');
  }
  await sql`
    update places set name = ${p.name}, short = ${p.short}, address = ${p.address}, meeting = ${p.meeting}, description = ${p.description},
      modality = ${p.modality}, capacity = ${p.capacity}, weekdays = ${pgArray([...new Set(p.weekdays)].sort())}::int[], hours = ${pgArray([...new Set(p.hours)].sort())}::text[],
      schedule = ${p.schedule}, price_single = ${p.prices.single}, price_pack5 = ${p.prices.pack5}, price_pack10 = ${p.prices.pack10},
      image_id = ${p.imageId}, wave_factor = ${p.waveFactor}, active = ${p.active}
    where id = ${id}`;
  await audit(sql, { actorType: 'ADMIN', actorId: c.get('admin').id, action: 'PLACE_UPDATED', entity: 'place', entityId: id });
  await purge(c, [...PUBLIC_CACHE, `/__cache/forecast/${id}`]);
  return c.json({ ok: true });
});

// --- Configurações, textos, imagens e políticas -----------------------------------------
adminRoutes.get('/settings', async (c) => {
  const s = await c.get('settings')();
  return c.json({
    settings: {
      school: s.school,
      instructor: s.instructor,
      whatsapp: s.whatsapp,
      pixKey: s.pix_key,
      pixName: s.pix_name,
      pixCity: s.pix_city,
      depositPct: s.deposit_pct,
      holdMinutes: s.hold_minutes,
      autoConfirm: s.auto_confirm,
      cancelLimitHours: s.cancel_limit_hours,
      rescheduleLimit: s.reschedule_limit,
      rescheduleLimitHours: s.reschedule_limit_hours,
      minNoticeHours: s.min_notice_hours,
      horizonDays: s.horizon_days,
      pack5Days: s.pack5_days,
      pack10Days: s.pack10_days,
      remindStudentHours: s.remind_student_hours,
      remindAdminHours: s.remind_admin_hours,
      remindMorningAt: s.remind_morning_at,
      quiverEnabled: s.quiver_enabled,
    },
    texts: s.texts,
    images: s.images,
    privacyPolicy: s.privacy_policy || DEFAULT_PRIVACY(s.school, s.instructor),
    terms: s.terms || DEFAULT_TERMS(s.school),
  });
});

adminRoutes.put('/settings', async (c) => {
  const v = await parseJson(c, settingsSchema);
  const wa = normalizeBrazilPhone(v.whatsapp, { requireMobile: true });
  if (!wa.ok) throw badRequest(wa.error, 'INVALID_PHONE');
  const sql = c.get('db')();
  const uniq = (a: number[]) => pgArray([...new Set(a)].sort((x, y) => y - x));
  await sql`
    update settings set school = ${v.school}, instructor = ${v.instructor}, whatsapp = ${wa.e164}, pix_key = ${normalizePixKey(v.pixKey)},
      pix_name = ${v.pixName}, pix_city = ${v.pixCity}, deposit_pct = ${v.depositPct}, hold_minutes = ${v.holdMinutes}, auto_confirm = ${v.autoConfirm},
      cancel_limit_hours = ${v.cancelLimitHours}, reschedule_limit = ${v.rescheduleLimit}, reschedule_limit_hours = ${v.rescheduleLimitHours},
      min_notice_hours = ${v.minNoticeHours}, horizon_days = ${v.horizonDays}, pack5_days = ${v.pack5Days}, pack10_days = ${v.pack10Days},
      remind_student_hours = ${uniq(v.remindStudentHours)}::int[], remind_admin_hours = ${uniq(v.remindAdminHours)}::int[], remind_morning_at = ${v.remindMorningAt},
      quiver_enabled = ${v.quiverEnabled}, updated_at = now()
    where id = 1`;
  await audit(sql, { actorType: 'ADMIN', actorId: c.get('admin').id, action: 'SETTINGS_UPDATED', entity: 'settings' });
  await purge(c, PUBLIC_CACHE);
  return c.json({ ok: true });
});

adminRoutes.put('/texts', async (c) => {
  const t = await parseJson(c, textsSchema);
  // Campo vazio = volta ao texto padrão.
  const stored = Object.fromEntries(Object.entries(t).filter(([, v]) => v));
  await c.get('db')()`update settings set texts = ${c.get('db')().json(stored as never)}, updated_at = now() where id = 1`;
  await purge(c, PUBLIC_CACHE);
  return c.json({ ok: true });
});

adminRoutes.put('/images', async (c) => {
  const body = await parseJson(c, z.object({ slot: z.enum(Object.keys(IMAGE_SLOTS) as [string, ...string[]]), imageId: z.string().regex(/^[a-f0-9]{24}$/).nullable() }));
  const sql = c.get('db')();
  if (body.imageId) {
    const [img] = await sql`select 1 from images where id = ${body.imageId}`;
    if (!img) throw notFound('Imagem não encontrada.');
    await sql`update settings set images = images || ${sql.json({ [body.slot]: body.imageId } as never)}, updated_at = now() where id = 1`;
  } else await sql`update settings set images = images - ${body.slot}, updated_at = now() where id = 1`;
  await purge(c, PUBLIC_CACHE);
  return c.json({ ok: true });
});

adminRoutes.put('/legal', async (c) => {
  const v = await parseJson(c, legalSchema);
  await c.get('db')()`update settings set privacy_policy = ${v.privacyPolicy}, terms = ${v.terms}, updated_at = now() where id = 1`;
  await purge(c, PUBLIC_CACHE);
  return c.json({ ok: true });
});

adminRoutes.post('/images', async (c) => {
  const text = await c.req.text();
  if (text.length > 1_300_000) throw badRequest('Imagem muito grande.');
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw badRequest('JSON inválido.');
  }
  const r = imageUploadSchema.safeParse(body);
  if (!r.success) throw badRequest(r.error.issues[0]?.message ?? 'Imagem inválida.');
  const sql = c.get('db')();
  await rateLimit(sql, `img:${c.get('admin').id}`, 60, 3600);
  const id = await saveImage(sql, r.data);
  return c.json({ id, url: `/img/${id}` }, 201);
});

// --- Financeiro -------------------------------------------------------------------------
adminRoutes.get('/finance', async (c) => {
  const q = parseQuery(c, z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional(), format: z.enum(['json', 'csv']).default('json') }));
  const month = q.month ?? today().slice(0, 7);
  const sql = c.get('db')();
  const rows = await sql<{ id: string; amount_cents: number; method: string; kind: string; note: string | null; created_at: Date; code: string; plan: string; place: string; student: string }[]>`
    select p.id, p.amount_cents, p.method, p.kind, p.note, p.created_at, o.code, o.plan, pl.short as place, s.name as student
    from payments p join orders o on o.id = p.order_id join places pl on pl.id = o.place_id join students s on s.id = o.student_id
    where to_char(p.created_at at time zone 'America/Bahia', 'YYYY-MM') = ${month} order by p.created_at desc`;
  const open = await selectOrders(sql, `(status = 'active' and paid_cents < total_cents) or refund_due_cents > 0 order by created_at desc limit 200`, []);
  const names = await studentNames(c, [...new Set(open.map((o) => o.student_id))]);
  if (q.format === 'csv') {
    // Aspas escapadas e fórmulas neutralizadas (=, +, -, @ no início viram texto no Excel).
    const esc = (v: string) => `"${(/^[=+\-@\t]/.test(v) ? "'" + v : v).replace(/"/g, '""')}"`;
    const lines = [['data', 'aluno', 'pedido', 'plano', 'local', 'tipo', 'forma', 'valor'].join(';')];
    for (const r of rows) {
      lines.push([new Date(r.created_at).toLocaleString('pt-BR', { timeZone: 'America/Bahia' }), r.student, r.code, PLANS[r.plan as keyof typeof PLANS]?.label ?? r.plan, r.place, r.kind, r.method, (r.amount_cents / 100).toFixed(2).replace('.', ',')].map((x) => esc(String(x))).join(';'));
    }
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="financeiro-${month}.csv"`);
    return c.body('﻿' + lines.join('\n'));
  }
  return c.json({
    month,
    payments: rows.map((r) => ({ id: r.id, amountCents: r.amount_cents, method: r.method, kind: r.kind, note: r.note, at: new Date(r.created_at).toISOString(), code: r.code, plan: r.plan, place: r.place, student: r.student })),
    totals: {
      received: rows.filter((r) => r.amount_cents > 0).reduce((n, r) => n + r.amount_cents, 0),
      refunded: -rows.filter((r) => r.amount_cents < 0).reduce((n, r) => n + r.amount_cents, 0),
      pix: rows.filter((r) => r.method === 'pix' && r.amount_cents > 0).reduce((n, r) => n + r.amount_cents, 0),
    },
    open: open.map((o) => ({ ...orderView(o), student: names[o.student_id]?.name ?? '' })),
  });
});

// --- Sistema -----------------------------------------------------------------------------
adminRoutes.get('/system', async (c) => c.json(await systemStatus(c.get('db')(), c.env)));
adminRoutes.post('/forecast/refresh', async (c) => {
  const sql = c.get('db')();
  await rateLimit(sql, 'forecast:manual', 6, 3600);
  const r = await refreshForecasts(sql, c.env);
  await recordStatus(sql, 'forecast', r.failed.length === 0, r.failed.length ? `Falhou: ${r.failed.join(', ')}` : `OK: ${r.ok.join(', ')}`);
  await purge(c, r.ok.map((id) => `/__cache/forecast/${id}`));
  return c.json(r);
});
adminRoutes.get('/audit', async (c) => {
  const rows = await c.get('db')()<{ id: string; actor_type: string; action: string; entity: string; entity_id: string | null; created_at: Date }[]>`
    select id::text, actor_type, action, entity, entity_id, created_at from audit_log order by created_at desc limit 100`;
  return c.json({ entries: rows.map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() })) });
});
