// Rotas do aluno: cadastro, acesso, agenda, pagamento (Pix), cancelamento, remarcação e perfil.
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';

import { AVATARS, avatarOf } from '../../shared/avatars';
import { PLANS } from '../../shared/domain';
import { formatBRL } from '../../shared/money';
import { bookSchema, cleanText, loginSchema, password, phoneInput, pushSubscriptionSchema, rescheduleSchema, signupSchema } from '../../shared/schemas';
import { zonedParts } from '../../shared/time';
import { background } from '../lib/background';
import { badRequest, unauthorized } from '../lib/errors';
import { paramId, parseJson } from '../lib/http';
import { rateLimit } from '../lib/ratelimit';
import {
  cancelByStudent,
  claimPix,
  createStudentBooking,
  getBooking,
  getOrder,
  rescheduleByStudent,
  selectBookings,
  selectOrders,
} from '../services/bookings';
import { inbox, pushTo, removeSubscription, saveSubscription, whenLabel } from '../services/notify';
import { getPlace, toBoard, type BoardRow } from '../services/settings';
import * as auth from '../services/student-auth';
import { bookingView, orderView, pixFor } from '../services/views';
import type { AppEnv, Ctx } from '../types';

export const studentRoutes = new Hono<AppEnv>();

const fmtDay = (d: string) => d.split('-').reverse().slice(0, 2).join('/');

function setSession(c: Ctx, token: string, maxAge: number) {
  setCookie(c, auth.STUDENT_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'Strict', path: '/', maxAge });
}

// --- Abertas ---------------------------------------------------------------
studentRoutes.post('/auth/signup', async (c) => {
  const body = await parseJson(c, signupSchema);
  if (body.website) throw badRequest('Não foi possível concluir o cadastro.');
  const r = await auth.signup(c.get('db')(), c.get('ipKey'), body);
  setSession(c, r.token, r.maxAge);
  return c.json({ ok: true }, 201);
});

studentRoutes.post('/auth/login', async (c) => {
  const { phone, password: pw } = await parseJson(c, loginSchema);
  const r = await auth.login(c.get('db')(), c.get('ipKey'), phone, pw);
  setSession(c, r.token, r.maxAge);
  return c.json({ ok: true });
});

studentRoutes.post('/auth/reset', async (c) => {
  const body = await parseJson(c, z.object({ phone: phoneInput, code: z.string().regex(/^\d{6}$/, 'Código de 6 dígitos.'), password }));
  const r = await auth.resetWithCode(c.get('db')(), c.get('ipKey'), body);
  setSession(c, r.token, r.maxAge);
  return c.json({ ok: true });
});

studentRoutes.post('/auth/logout', async (c) => {
  await auth.logout(c.get('db')(), getCookie(c, auth.STUDENT_COOKIE));
  deleteCookie(c, auth.STUDENT_COOKIE, { path: '/', secure: true });
  return c.json({ ok: true });
});

// --- Daqui para baixo: sessão do aluno -------------------------------------
studentRoutes.use('*', async (c, next) => {
  const id = await auth.sessionStudent(c.get('db')(), getCookie(c, auth.STUDENT_COOKIE));
  if (!id) throw unauthorized('Entre com seu celular e senha para continuar.', 'STUDENT_UNAUTHORIZED');
  c.set('studentId', id);
  await next();
});

/** Tudo que o app do aluno precisa numa ida só: perfil, aulas, pedidos, dicas e avisos. */
studentRoutes.get('/', async (c) => {
  const sql = c.get('db')();
  const s = await c.get('settings')();
  const id = c.get('studentId');
  const [me] = await sql<{ name: string; phone: string | null; level: string; board_id: string | null; avatar: string | null; created_at: Date }[]>`
    select name, phone, level, board_id, avatar, created_at from students where id = ${id}`;
  const bookings = await selectBookings(sql, `student_id = $1 and status <> 'expired' order by starts_at desc limit 200`, [id]);
  const orders = await selectOrders(sql, `student_id = $1 and status <> 'expired' order by created_at desc limit 100`, [id]);
  const used = await sql<{ order_id: string; n: number }[]>`
    select order_id, count(*)::int as n from bookings where student_id = ${id} and status not in ('cancelled','declined','expired') group by order_id`;
  const usedBy = Object.fromEntries(used.map((u) => [u.order_id, u.n]));
  const tips = await sql<{ id: string; text: string; created_at: Date }[]>`select id, text, created_at from tips where student_id = ${id} order by created_at desc limit 20`;
  const notices = await sql<{ id: string; title: string; body: string; booking_id: string | null; read_at: Date | null; created_at: Date }[]>`
    select id, title, body, booking_id, read_at, created_at from inbox where student_id = ${id} order by created_at desc limit 40`;
  let board = null;
  if (s.quiver_enabled && me.board_id) {
    const [b] = await sql<BoardRow[]>`select * from boards where id = ${me.board_id}`;
    board = b ? toBoard(b) : null;
  }
  return c.json({
    profile: { name: me.name, phone: me.phone, level: me.level, avatar: avatarOf({ id, avatar: me.avatar }), board, since: new Date(me.created_at).toISOString() },
    bookings: bookings.map((b) => bookingView(b, s)),
    orders: orders.map((o) => orderView(o, usedBy[o.id] ?? 0)),
    tips: tips.map((t) => ({ id: t.id, text: t.text, at: new Date(t.created_at).toISOString() })),
    inbox: notices.map((n) => ({ id: n.id, title: n.title, body: n.body, bookingId: n.booking_id, read: !!n.read_at, at: new Date(n.created_at).toISOString() })),
  });
});

studentRoutes.post('/profile', async (c) => {
  const { name } = await parseJson(c, z.object({ name: cleanText(60, 2) }));
  await c.get('db')()`update students set name = ${name} where id = ${c.get('studentId')}`;
  return c.json({ ok: true });
});

studentRoutes.post('/avatar', async (c) => {
  const { avatar } = await parseJson(c, z.object({ avatar: z.enum(AVATARS) }));
  await c.get('db')()`update students set avatar = ${avatar} where id = ${c.get('studentId')}`;
  return c.json({ ok: true });
});

studentRoutes.post('/password', async (c) => {
  const body = await parseJson(c, z.object({ current: password, next: password }));
  await auth.changePassword(c.get('db')(), c.get('studentId'), body.current, body.next, getCookie(c, auth.STUDENT_COOKIE));
  return c.json({ ok: true });
});

studentRoutes.post('/delete', async (c) => {
  const id = c.get('studentId');
  await auth.anonymize(c.get('db')(), id, { type: 'STUDENT', id });
  deleteCookie(c, auth.STUDENT_COOKIE, { path: '/', secure: true });
  return c.json({ ok: true });
});

/** Cópia dos dados (LGPD: direito de acesso e portabilidade). */
studentRoutes.get('/export', async (c) => {
  const sql = c.get('db')();
  const id = c.get('studentId');
  const [me] = await sql`select name, phone, level, created_at, consent_at from students where id = ${id}`;
  const bookings = await sql`select code, place_id, to_char(date, 'YYYY-MM-DD') as date, time, status, created_at from bookings where student_id = ${id} order by starts_at`;
  const orders = await sql`select code, place_id, plan, total_cents, paid_cents, refunded_cents, status, created_at from orders where student_id = ${id} order by created_at`;
  c.header('Content-Disposition', 'attachment; filename="meus-dados-outside.json"');
  return c.json({ geradoEm: new Date().toISOString(), aluno: me, aulas: bookings, pedidos: orders });
});

studentRoutes.post('/inbox/read', async (c) => {
  await c.get('db')()`update inbox set read_at = now() where student_id = ${c.get('studentId')} and read_at is null`;
  return c.json({ ok: true });
});

// --- Agendar e pagar --------------------------------------------------------
studentRoutes.post('/bookings', async (c) => {
  const input = await parseJson(c, bookSchema);
  const sql = c.get('db')();
  const s = await c.get('settings')();
  const id = c.get('studentId');
  await rateLimit(sql, `book:${id}`, 12, 3600);
  const r = await createStudentBooking(sql, s, id, input);
  if (!r.replay && r.booking.status !== 'pending_payment') {
    const place = await getPlace(sql, r.booking.place_id);
    const [st] = await sql<{ name: string }[]>`select name from students where id = ${id}`;
    const n = { title: 'Novo agendamento · pacote', body: `${st.name} · ${place.short} · ${fmtDay(r.booking.date)} às ${r.booking.time}`, bookingId: r.booking.id };
    await inbox(sql, 'admin', n);
    background(c, (bg) => pushTo(bg, c.env, 'admin', n));
  }
  return c.json({ booking: bookingView(r.booking, s), order: orderView(r.order), pix: r.booking.status === 'pending_payment' ? pixFor(r.order, s) : null, replay: r.replay }, r.replay ? 200 : 201);
});

studentRoutes.get('/orders/:id/pix', async (c) => {
  const o = await getOrder(c.get('db')(), paramId(c));
  if (o.student_id !== c.get('studentId')) throw unauthorized();
  return c.json(pixFor(o, await c.get('settings')()));
});

/** "Já fiz o Pix": segura o horário e avisa o instrutor para conferir. */
studentRoutes.post('/orders/:id/pix-sent', async (c) => {
  const sql = c.get('db')();
  const id = c.get('studentId');
  const { cents } = await parseJson(c, z.object({ cents: z.number().int().min(1).max(10_000_000) }));
  await rateLimit(sql, `pixsent:${id}`, 10, 3600);
  const r = await claimPix(sql, id, paramId(c));
  const [st] = await sql<{ name: string }[]>`select name from students where id = ${id}`;
  const b = r.bookings[0];
  const place = await getPlace(sql, r.order.place_id);
  const n = {
    title: `Pix informado · ${formatBRL(cents)}`,
    body: `${st.name} diz que pagou ${formatBRL(cents)} (${PLANS[r.order.plan].label}, ${place.short}${b ? ` · ${fmtDay(b.date)} às ${b.time}` : ''}). Confira no banco e confirme no painel.`,
    bookingId: b?.id ?? null,
  };
  await inbox(sql, 'admin', n);
  background(c, (bg) => pushTo(bg, c.env, 'admin', n));
  return c.json({ ok: true });
});

studentRoutes.post('/bookings/:id/cancel', async (c) => {
  const sql = c.get('db')();
  const s = await c.get('settings')();
  const id = c.get('studentId');
  const r = await cancelByStudent(sql, s, id, paramId(c));
  const [st] = await sql<{ name: string }[]>`select name from students where id = ${id}`;
  const place = await getPlace(sql, r.booking.place_id);
  const n = {
    title: r.refund ? `Cancelamento · devolver ${formatBRL(r.refund)}` : 'Aula cancelada pelo aluno',
    body: `${st.name} · ${place.short} · ${fmtDay(r.booking.date)} às ${r.booking.time}${r.refund ? `. Devolva ${formatBRL(r.refund)} e marque como devolvido no painel.` : ''}`,
    bookingId: r.booking.id,
  };
  if (r.booking.status !== 'pending_payment') {
    await inbox(sql, 'admin', n);
    background(c, (bg) => pushTo(bg, c.env, 'admin', n));
  }
  return c.json({ ok: true, refundCents: r.refund });
});

studentRoutes.post('/bookings/:id/reschedule', async (c) => {
  const body = await parseJson(c, rescheduleSchema);
  const sql = c.get('db')();
  const s = await c.get('settings')();
  const id = c.get('studentId');
  const { before, after } = await rescheduleByStudent(sql, s, id, paramId(c), body.date, body.time);
  const [st] = await sql<{ name: string }[]>`select name from students where id = ${id}`;
  const place = await getPlace(sql, after.place_id);
  const n = { title: 'Aula remarcada pelo aluno', body: `${st.name} · ${place.short} · de ${fmtDay(before.date)} ${before.time} para ${whenLabel(after.date, after.time, zonedParts(new Date()).date)}`, bookingId: after.id };
  await inbox(sql, 'admin', n);
  background(c, (bg) => pushTo(bg, c.env, 'admin', n));
  return c.json({ booking: bookingView(after, s) });
});

studentRoutes.get('/bookings/:id/events', async (c) => {
  const sql = c.get('db')();
  const b = await getBooking(sql, paramId(c));
  if (b.student_id !== c.get('studentId')) throw unauthorized();
  const ev = await sql<{ text: string; created_at: Date }[]>`select text, created_at from booking_events where booking_id = ${b.id} order by created_at`;
  return c.json({ events: ev.map((e) => ({ text: e.text, at: new Date(e.created_at).toISOString() })) });
});

// --- Notificações deste aparelho --------------------------------------------
studentRoutes.post('/push/subscribe', async (c) => {
  const { subscription } = await parseJson(c, z.object({ subscription: pushSubscriptionSchema }));
  await rateLimit(c.get('db')(), `pushsub:${c.get('studentId')}`, 20, 3600);
  await saveSubscription(c.get('db')(), { studentId: c.get('studentId') }, subscription);
  return c.json({ ok: true });
});

studentRoutes.post('/push/unsubscribe', async (c) => {
  const { endpoint } = await parseJson(c, z.object({ endpoint: z.string().url().max(1000) }));
  await removeSubscription(c.get('db')(), endpoint, { studentId: c.get('studentId') });
  return c.json({ ok: true });
});
