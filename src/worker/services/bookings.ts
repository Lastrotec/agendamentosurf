// Agenda, pedidos e aulas. Toda regra de vaga, crédito, prazo e reembolso vive aqui (no servidor).
import type { Sql, TransactionSql } from 'postgres';

import { type DaySlots, depositFor, LIVE_STATUSES, PLANS, type PlanId } from '../../shared/domain';
import { type ForecastData, lowTideMinutes } from '../../shared/forecast';
import { normalizeBrazilPhone } from '../../shared/phone';
import { daySlots, slotBookable } from '../../shared/slots';
import { addDays, zonedParts, zonedToUtc } from '../../shared/time';
import { audit } from '../lib/audit';
import { randomToken } from '../lib/crypto';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors';
import { getPlace, type PlaceRow, type SettingsRow } from './settings';

const TZ = 'America/Bahia';
type Q = Sql | TransactionSql;

export const today = (now = new Date()) => zonedParts(now, TZ).date;

export function newCode(): string {
  return 'OS' + randomToken(9).replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6).padEnd(6, 'X');
}

export interface BookingRow {
  id: string;
  code: string;
  order_id: string;
  student_id: string;
  place_id: string;
  date: string;
  time: string;
  starts_at: Date;
  people: number;
  status: (typeof LIVE_STATUSES)[number] | 'done' | 'no_show' | 'cancelled' | 'declined' | 'expired';
  hold_until: Date | null;
  pix_claimed_at: Date | null;
  board_id: string | null;
  rescheduled: number;
  cancelled_by: string | null;
  reason: string | null;
  created_at: Date;
}

export interface OrderRow {
  id: string;
  code: string;
  student_id: string;
  place_id: string;
  plan: PlanId;
  lessons: number;
  people: number;
  companion: string | null;
  total_cents: number;
  deposit_cents: number;
  paid_cents: number;
  refunded_cents: number;
  refund_due_cents: number;
  expires_on: string | null;
  status: 'pending' | 'active' | 'paid' | 'cancelled' | 'expired';
  source: 'student' | 'admin';
  created_at: Date;
}

// Datas como texto (YYYY-MM-DD) em todas as leituras: o driver roda sem busca de tipos.
const BOOKING_COLS = `id, code, order_id, student_id, place_id, to_char(date, 'YYYY-MM-DD') as date, time, starts_at, people, status,
  hold_until, pix_claimed_at, board_id, rescheduled, cancelled_by, reason, created_at`;
const ORDER_COLS = `id, code, student_id, place_id, plan, lessons, people, companion, total_cents, deposit_cents, paid_cents,
  refunded_cents, refund_due_cents, to_char(expires_on, 'YYYY-MM-DD') as expires_on, status, source, created_at`;

export async function getBooking(sql: Q, id: string): Promise<BookingRow> {
  const [b] = await sql.unsafe<BookingRow[]>(`select ${BOOKING_COLS} from bookings where id = $1`, [id]);
  if (!b) throw notFound('Aula não encontrada.');
  return b;
}

export async function getOrder(sql: Q, id: string): Promise<OrderRow> {
  const [o] = await sql.unsafe<OrderRow[]>(`select ${ORDER_COLS} from orders where id = $1`, [id]);
  if (!o) throw notFound('Pedido não encontrado.');
  return o;
}

export const selectBookings = (sql: Q, where: string, params: unknown[]) =>
  sql.unsafe<BookingRow[]>(`select ${BOOKING_COLS} from bookings where ${where}`, params as never[]);
export const selectOrders = (sql: Q, where: string, params: unknown[]) =>
  sql.unsafe<OrderRow[]>(`select ${ORDER_COLS} from orders where ${where}`, params as never[]);

async function event(sql: Q, bookingId: string, text: string) {
  await sql`insert into booking_events (booking_id, text) values (${bookingId}, ${text.slice(0, 300)})`;
}

// ---------------------------------------------------------------------------
// Disponibilidade
// ---------------------------------------------------------------------------
export async function availability(
  sql: Q,
  s: SettingsRow,
  place: PlaceRow,
  from: string,
  days: number,
  opts: { now?: Date; ignoreBooking?: string; forecast?: ForecastData | null } = {},
): Promise<DaySlots[]> {
  const now = opts.now ?? new Date();
  const to = addDays(from, days - 1);
  const taken = await sql<{ date: string; time: string; n: number }[]>`
    select to_char(date, 'YYYY-MM-DD') as date, time, sum(people)::int as n from bookings
    where place_id = ${place.id} and date between ${from} and ${to} and status in ('pending_payment','awaiting','confirmed')
      and (status <> 'pending_payment' or hold_until > now() or pix_claimed_at is not null)
      and id <> ${opts.ignoreBooking ?? '00000000-0000-0000-0000-000000000000'}
    group by date, time`;
  const blocks = await sql<{ date: string; time: string | null }[]>`
    select to_char(date, 'YYYY-MM-DD') as date, time from slot_blocks where place_id = ${place.id} and date between ${from} and ${to}`;
  const overrides = await sql<{ date: string; hours: string[] }[]>`
    select to_char(date, 'YYYY-MM-DD') as date, to_json(hours) as hours from day_hours where place_id = ${place.id} and date between ${from} and ${to}`;
  let fc = opts.forecast ?? null;
  if (place.schedule === 'tide' && fc === null) {
    const [f] = await sql<{ data: ForecastData }[]>`select data from forecasts where place_id = ${place.id} and ok`;
    fc = f?.data ?? null;
  }
  const horizon = addDays(today(now), s.horizon_days);
  const out: DaySlots[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const t: Record<string, number> = {};
    for (const r of taken) if (r.date === d) t[r.time] = r.n;
    const day = daySlots({
      place,
      date: d,
      now,
      minNoticeHours: s.min_notice_hours,
      taken: t,
      blocks: blocks.filter((b) => b.date === d).map((b) => b.time),
      override: overrides.find((o) => o.date === d)?.hours ?? null,
      forecastLow: place.schedule === 'tide' ? lowTideMinutes(fc, d) : null,
    });
    if (d > horizon) {
      day.open = false;
      day.slots = day.slots.map((x) => ({ ...x, closed: true }));
    }
    out.push(day);
  }
  return out;
}

/** Trava o horário (place/data/hora) até o fim da transação: impede duas reservas na mesma última vaga. */
async function lockSlot(tx: TransactionSql, place: string, date: string, time: string) {
  await tx`select pg_advisory_xact_lock(hashtext(${`slot:${place}:${date}:${time}`}))`;
}

async function assertSlot(tx: TransactionSql, s: SettingsRow, place: PlaceRow, date: string, time: string, people: number, opts: { ignore?: string; admin?: boolean } = {}) {
  await lockSlot(tx, place.id, date, time);
  const [day] = await availability(tx, s, place, date, 1, { ignoreBooking: opts.ignore });
  const slot = day.slots.find((x) => x.time === time);
  if (!slot) throw conflict('Este horário não existe neste dia. Escolha outro.', 'SLOT_UNAVAILABLE');
  if (opts.admin) {
    if (slot.free < people) throw conflict('Não há vagas suficientes neste horário.', 'SLOT_FULL');
    return;
  }
  if (!slotBookable(slot, people)) {
    throw conflict(slot.free < people && slot.free > 0 ? 'Só resta 1 vaga neste horário.' : 'Este horário não está mais disponível. Escolha outro.', 'SLOT_UNAVAILABLE');
  }
}

function creditsUsedSql(tx: Q, orderId: string) {
  return tx<{ n: number }[]>`select count(*)::int as n from bookings where order_id = ${orderId} and status not in ('cancelled','declined','expired')`;
}

// ---------------------------------------------------------------------------
// Aluno agenda
// ---------------------------------------------------------------------------
export interface BookInput {
  place: string;
  plan: PlanId | 'credit';
  orderId?: string;
  people: number;
  companion?: string;
  date: string;
  time: string;
  idempotencyKey: string;
}

export async function createStudentBooking(sql: Sql, s: SettingsRow, studentId: string, input: BookInput) {
  const place = await getPlace(sql, input.place);
  if (!place.active) throw badRequest('Este local não está recebendo agendamentos.');
  const [replay] = await sql<{ id: string }[]>`select id from orders where idempotency_key = ${input.idempotencyKey} and student_id = ${studentId}`;
  if (replay) {
    const [b] = await selectBookings(sql, 'order_id = $1 order by created_at desc limit 1', [replay.id]);
    return { booking: b, order: await getOrder(sql, replay.id), replay: true };
  }
  const people = input.plan === 'single' && place.capacity > 1 ? Math.min(input.people, place.capacity) : 1;
  if (people > 1 && !input.companion) throw badRequest('Informe o nome de quem vai com você.');

  return sql.begin(async (tx) => {
    // Duplo toque: a segunda requisição espera a primeira e devolve o mesmo pedido.
    await tx`select pg_advisory_xact_lock(hashtext(${`idem:${input.idempotencyKey}`}))`;
    const [again] = await tx<{ id: string }[]>`select id from orders where idempotency_key = ${input.idempotencyKey} and student_id = ${studentId}`;
    if (again) {
      const [b] = await selectBookings(tx, 'order_id = $1 order by created_at desc limit 1', [again.id]);
      return { booking: b, order: await getOrder(tx, again.id), replay: true };
    }
    await assertSlot(tx, s, place, input.date, input.time, people);
    const [mine] = await tx`
      select 1 from bookings where student_id = ${studentId} and date = ${input.date} and time = ${input.time}
        and status in ('pending_payment','awaiting','confirmed') and (status <> 'pending_payment' or hold_until > now() or pix_claimed_at is not null)`;
    if (mine) throw conflict('Você já tem uma aula neste horário.', 'DUPLICATE');
    const startsAt = zonedToUtc(input.date, input.time, TZ);

    if (input.plan === 'credit') {
      if (!input.orderId) throw badRequest('Escolha o pacote.');
      const o = await getOrder(tx, input.orderId);
      if (o.student_id !== studentId || o.plan === 'single' || o.place_id !== place.id) throw forbidden('Pacote inválido para este local.');
      if (!['active', 'paid'].includes(o.status)) throw conflict('O pacote ainda não tem o sinal pago.', 'PACK_UNPAID');
      if (o.expires_on && o.expires_on < input.date) throw conflict(`O pacote vale até ${o.expires_on.split('-').reverse().join('/')}. Escolha uma data anterior.`, 'PACK_EXPIRED');
      const [{ n }] = await creditsUsedSql(tx, o.id);
      if (n >= o.lessons) throw conflict('Os créditos deste pacote acabaram.', 'NO_CREDITS');
      const [b] = await tx.unsafe<BookingRow[]>(
        `insert into bookings (code, order_id, student_id, place_id, date, time, starts_at, people, status, board_id)
         values ($1,$2,$3,$4,$5,$6,$7,1,$8,(select board_id from students where id = $3)) returning ${BOOKING_COLS}`,
        [newCode(), o.id, studentId, place.id, input.date, input.time, startsAt, s.auto_confirm ? 'confirmed' : 'awaiting'] as never[],
      );
      await event(tx, b.id, `Agendada com crédito do pacote (${n + 1}/${o.lessons})`);
      return { booking: b, order: o, replay: false };
    }

    const plan = input.plan;
    const total = plan === 'single' ? place.price_single * people : plan === 'pack5' ? place.price_pack5 : place.price_pack10;
    const validity = plan === 'pack5' ? s.pack5_days : plan === 'pack10' ? s.pack10_days : 0;
    const [o] = await tx.unsafe<OrderRow[]>(
      `insert into orders (code, student_id, place_id, plan, lessons, people, companion, total_cents, deposit_cents, expires_on, idempotency_key)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning ${ORDER_COLS}`,
      [
        newCode(),
        studentId,
        place.id,
        plan,
        PLANS[plan].lessons,
        people,
        people > 1 ? input.companion! : null,
        total,
        depositFor(total, s.deposit_pct),
        validity ? addDays(today(), validity) : null,
        input.idempotencyKey,
      ] as never[],
    );
    const [b] = await tx.unsafe<BookingRow[]>(
      `insert into bookings (code, order_id, student_id, place_id, date, time, starts_at, people, status, hold_until, board_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'pending_payment', now() + make_interval(mins => $9), (select board_id from students where id = $3))
       returning ${BOOKING_COLS}`,
      [newCode(), o.id, studentId, place.id, input.date, input.time, startsAt, people, s.hold_minutes] as never[],
    );
    await event(tx, b.id, 'Horário reservado aguardando o sinal');
    return { booking: b, order: o, replay: false };
  });
}

/** Aluno avisa que fez o Pix: o horário deixa de expirar e o instrutor confere o recebimento. */
export async function claimPix(sql: Sql, studentId: string, orderId: string) {
  const o = await getOrder(sql, orderId);
  if (o.student_id !== studentId) throw notFound('Pedido não encontrado.');
  const rows = await selectBookings(
    sql,
    `order_id = $1 and status = 'pending_payment' and (hold_until > now() or pix_claimed_at is not null)`,
    [orderId],
  );
  const owes = o.paid_cents < o.total_cents;
  if (!rows.length && !owes) throw conflict('Este pedido já está pago.', 'ALREADY_PAID');
  const expired = await selectBookings(sql, `order_id = $1 and status = 'expired'`, [orderId]);
  if (!rows.length && expired.length && o.paid_cents === 0) throw conflict('O tempo para pagar este horário acabou. Faça um novo agendamento.', 'HOLD_EXPIRED');
  await sql`update bookings set pix_claimed_at = coalesce(pix_claimed_at, now()), updated_at = now() where order_id = ${orderId} and status = 'pending_payment'`;
  for (const b of rows) await event(sql, b.id, 'Aluno informou que fez o Pix');
  return { order: o, bookings: rows };
}

// ---------------------------------------------------------------------------
// Pagamentos (Pix manual conferido pelo Romário; gateway entra aqui depois)
// ---------------------------------------------------------------------------
export async function recordPayment(sql: Sql, _s: SettingsRow, orderId: string, amountCents: number, method: 'pix' | 'card' | 'cash' | 'other', actor: { type: 'ADMIN' | 'SYSTEM'; id: string }, note?: string) {
  return sql.begin(async (tx) => {
    const [o] = await tx.unsafe<OrderRow[]>(`select ${ORDER_COLS} from orders where id = $1 for update`, [orderId]);
    if (!o) throw notFound('Pedido não encontrado.');
    if (o.status === 'cancelled') throw conflict('Pedido cancelado: não é possível registrar pagamento.');
    const due = o.total_cents - o.paid_cents;
    if (due <= 0) throw conflict('Este pedido já está quitado.', 'ALREADY_PAID');
    const amount = Math.min(amountCents, due);
    const kind = amount >= o.total_cents ? 'full' : o.paid_cents < o.deposit_cents ? 'deposit' : 'remaining';
    await tx`insert into payments (order_id, amount_cents, method, kind, note) values (${o.id}, ${amount}, ${method}, ${kind}, ${note ?? null})`;
    const paid = o.paid_cents + amount;
    await tx`update orders set paid_cents = ${paid}, status = ${paid >= o.total_cents ? 'paid' : 'active'}, updated_at = now() where id = ${o.id}`;
    // Pagamento conferido pelo instrutor confirma as aulas que aguardavam o sinal.
    const waiting = await selectBookings(tx, `order_id = $1 and status = 'pending_payment'`, [o.id]);
    for (const b of waiting) {
      await tx`update bookings set status = 'confirmed', hold_until = null, updated_at = now() where id = ${b.id}`;
      await event(tx, b.id, `Pagamento de ${(amount / 100).toFixed(2).replace('.', ',')} recebido · aula confirmada`);
    }
    await audit(tx, { actorType: actor.type, actorId: actor.id, action: 'PAYMENT_RECORDED', entity: 'order', entityId: o.id, data: { amount, method } });
    return { order: { ...o, paid_cents: paid }, amount, confirmed: waiting };
  });
}

/** Romário marca que devolveu o valor ao aluno (Pix de volta, por exemplo). */
export async function markRefunded(sql: Sql, orderId: string, adminId: string, method: 'pix' | 'card' | 'cash' | 'other' = 'pix') {
  return sql.begin(async (tx) => {
    const [o] = await tx.unsafe<OrderRow[]>(`select ${ORDER_COLS} from orders where id = $1 for update`, [orderId]);
    if (!o) throw notFound('Pedido não encontrado.');
    if (o.refund_due_cents <= 0) throw conflict('Não há valor a devolver neste pedido.');
    await tx`insert into payments (order_id, amount_cents, method, kind) values (${o.id}, ${-o.refund_due_cents}, ${method}, 'refund')`;
    await tx`update orders set refunded_cents = refunded_cents + refund_due_cents, refund_due_cents = 0, updated_at = now() where id = ${o.id}`;
    await audit(tx, { actorType: 'ADMIN', actorId: adminId, action: 'REFUND_DONE', entity: 'order', entityId: o.id, data: { amount: o.refund_due_cents } });
    return { amount: o.refund_due_cents, order: o };
  });
}

// ---------------------------------------------------------------------------
// Cancelamentos, recusas e remarcações
// ---------------------------------------------------------------------------
export const hoursUntil = (b: Pick<BookingRow, 'starts_at'>, now = new Date()) => (new Date(b.starts_at).getTime() - now.getTime()) / 3600e3;

/**
 * Cancela uma aula. Avulsa: o pedido é cancelado e todo o valor pago fica "a devolver".
 * Pacote: a aula volta como crédito (nada a devolver). Retorna o valor a devolver.
 */
async function cancelInternal(tx: TransactionSql, b: BookingRow, status: 'cancelled' | 'declined', by: 'student' | 'admin' | 'system', reason: string | null) {
  await tx`update bookings set status = ${status}, cancelled_by = ${by}, reason = ${reason}, hold_until = null, updated_at = now() where id = ${b.id}`;
  const [o] = await tx.unsafe<OrderRow[]>(`select ${ORDER_COLS} from orders where id = $1 for update`, [b.order_id]);
  let refund = 0;
  if (o.plan === 'single') {
    refund = Math.max(0, o.paid_cents - o.refunded_cents - o.refund_due_cents);
    await tx`update orders set status = 'cancelled', refund_due_cents = refund_due_cents + ${refund}, updated_at = now() where id = ${o.id}`;
  } else {
    const [{ n }] = await creditsUsedSql(tx, o.id);
    // Pacote sem nenhum pagamento e sem aulas: o pedido inteiro é cancelado.
    if (n === 0 && o.paid_cents === 0) await tx`update orders set status = 'cancelled', updated_at = now() where id = ${o.id}`;
  }
  await event(tx, b.id, `${status === 'declined' ? 'Recusada' : 'Cancelada'} pelo ${by === 'student' ? 'aluno' : by === 'admin' ? 'instrutor' : 'sistema'}${reason ? `: ${reason}` : ''}${refund ? ` · R$ ${(refund / 100).toFixed(2).replace('.', ',')} a devolver` : o.plan !== 'single' ? ' · crédito devolvido ao pacote' : ''}`);
  return { refund, order: o };
}

export async function cancelByStudent(sql: Sql, s: SettingsRow, studentId: string, bookingId: string) {
  return sql.begin(async (tx) => {
    const [b] = await tx.unsafe<BookingRow[]>(`select ${BOOKING_COLS} from bookings where id = $1 for update`, [bookingId]);
    if (!b || b.student_id !== studentId) throw notFound('Aula não encontrada.');
    if (!LIVE_STATUSES.includes(b.status as never)) throw conflict('Esta aula não pode mais ser cancelada.');
    // Reserva ainda sem pagamento: pode desistir a qualquer momento.
    if (b.status !== 'pending_payment' && hoursUntil(b) < s.cancel_limit_hours) {
      throw conflict(`O cancelamento pelo app vai até ${s.cancel_limit_hours} h antes da aula. Fale com o instrutor pelo WhatsApp.`, 'CANCEL_WINDOW');
    }
    const r = await cancelInternal(tx, b, 'cancelled', 'student', null);
    await audit(tx, { actorType: 'STUDENT', actorId: studentId, action: 'BOOKING_CANCELLED', entity: 'booking', entityId: b.id, data: { refund: r.refund } });
    return { booking: b, ...r };
  });
}

export async function cancelByAdmin(sql: Sql, bookingId: string, adminId: string, reason: string) {
  return sql.begin(async (tx) => {
    const [b] = await tx.unsafe<BookingRow[]>(`select ${BOOKING_COLS} from bookings where id = $1 for update`, [bookingId]);
    if (!b) throw notFound('Aula não encontrada.');
    if (!LIVE_STATUSES.includes(b.status as never)) throw conflict('Esta aula já não está ativa.');
    const status = b.status === 'confirmed' ? 'cancelled' : 'declined';
    const r = await cancelInternal(tx, b, status, 'admin', reason);
    await audit(tx, { actorType: 'ADMIN', actorId: adminId, action: status === 'declined' ? 'BOOKING_DECLINED' : 'BOOKING_CANCELLED', entity: 'booking', entityId: b.id, data: { refund: r.refund } });
    return { booking: b, status, ...r };
  });
}

export async function rescheduleByStudent(sql: Sql, s: SettingsRow, studentId: string, bookingId: string, date: string, time: string) {
  const b = await getBooking(sql, bookingId);
  if (b.student_id !== studentId) throw notFound('Aula não encontrada.');
  if (!['awaiting', 'confirmed'].includes(b.status)) throw conflict('Só aulas pagas podem ser remarcadas.');
  if (b.rescheduled >= s.reschedule_limit) throw conflict(s.reschedule_limit ? `Esta aula já foi remarcada ${s.reschedule_limit === 1 ? 'uma vez' : `${s.reschedule_limit} vezes`}.` : 'A remarcação pelo app está desativada.', 'RESCHEDULE_LIMIT');
  if (hoursUntil(b) < s.reschedule_limit_hours) throw conflict(`A remarcação pelo app vai até ${s.reschedule_limit_hours} h antes da aula. Fale com o instrutor.`, 'RESCHEDULE_WINDOW');
  return moveBooking(sql, s, b, date, time, { by: 'student', id: studentId });
}

export async function moveBooking(sql: Sql, s: SettingsRow, b: BookingRow, date: string, time: string, actor: { by: 'student' | 'admin'; id: string }) {
  const place = await getPlace(sql, b.place_id);
  const o = await getOrder(sql, b.order_id);
  if (o.expires_on && o.expires_on < date && actor.by === 'student') throw conflict('A nova data passa da validade do pacote.', 'PACK_EXPIRED');
  return sql.begin(async (tx) => {
    await assertSlot(tx, s, place, date, time, b.people, { ignore: b.id, admin: actor.by === 'admin' });
    const startsAt = zonedToUtc(date, time, TZ);
    await tx`
      update bookings set date = ${date}, time = ${time}, starts_at = ${startsAt},
        rescheduled = rescheduled + ${actor.by === 'student' ? 1 : 0}, updated_at = now() where id = ${b.id}`;
    await tx`delete from push_log where key like ${`r:%:${b.id}`}`; // lembretes valem para o novo horário
    const fmt = (d: string, t: string) => `${d.split('-').reverse().slice(0, 2).join('/')} ${t}`;
    await event(tx, b.id, `Remarcada pelo ${actor.by === 'student' ? 'aluno' : 'instrutor'} de ${fmt(b.date, b.time)} para ${fmt(date, time)}`);
    await audit(tx, { actorType: actor.by === 'student' ? 'STUDENT' : 'ADMIN', actorId: actor.id, action: 'BOOKING_MOVED', entity: 'booking', entityId: b.id, data: { from: `${b.date} ${b.time}`, to: `${date} ${time}` } });
    return { before: b, after: await getBooking(tx, b.id) };
  });
}

/** Reservas sem pagamento depois do prazo viram "expirada" (exceto quando o aluno avisou que fez o Pix). */
export async function expireHolds(sql: Sql): Promise<number> {
  const rows = await sql<{ id: string; order_id: string }[]>`
    update bookings set status = 'expired', updated_at = now()
    where status = 'pending_payment' and hold_until < now() and pix_claimed_at is null
    returning id, order_id`;
  for (const r of rows) {
    await sql`insert into booking_events (booking_id, text) values (${r.id}, 'Expirada: o sinal não foi pago no prazo')`;
    await sql`
      update orders o set status = 'expired', updated_at = now() where o.id = ${r.order_id} and o.status = 'pending' and o.paid_cents = 0
        and not exists (select 1 from bookings b where b.order_id = o.id and b.status in ('pending_payment','awaiting','confirmed'))`;
  }
  return rows.length;
}

// ---------------------------------------------------------------------------
// Agendamento feito pelo instrutor
// ---------------------------------------------------------------------------
export async function createAdminBooking(
  sql: Sql,
  s: SettingsRow,
  adminId: string,
  input: {
    studentId?: string;
    newStudent?: { name: string; phone: string };
    place: string;
    plan: PlanId | 'credit';
    people: number;
    companion?: string;
    date: string;
    time: string;
    paid: 'none' | 'deposit' | 'full';
    method: 'pix' | 'card' | 'cash' | 'other';
  },
) {
  const place = await getPlace(sql, input.place);
  let studentId = input.studentId;
  if (!studentId) {
    if (!input.newStudent) throw badRequest('Escolha o aluno.');
    const p = normalizeBrazilPhone(input.newStudent.phone, { requireMobile: true });
    if (!p.ok) throw badRequest(p.error, 'INVALID_PHONE');
    const [st] = await sql<{ id: string }[]>`
      insert into students (name, phone) values (${input.newStudent.name}, ${p.e164})
      on conflict (phone) do update set phone = excluded.phone returning id`;
    studentId = st.id;
  }
  const people = Math.min(Math.max(1, input.people), place.capacity);
  const result = await sql.begin(async (tx) => {
    await assertSlot(tx, s, place, input.date, input.time, people, { admin: true });
    let o: OrderRow;
    if (input.plan === 'credit') {
      const packs = await selectOrders(
        tx,
        `student_id = $1 and place_id = $2 and plan <> 'single' and status in ('active','paid') and (expires_on is null or expires_on >= $3) order by created_at`,
        [studentId, place.id, input.date],
      );
      let found: OrderRow | null = null;
      for (const p of packs) {
        const [{ n }] = await creditsUsedSql(tx, p.id);
        if (n < p.lessons) {
          found = p;
          break;
        }
      }
      if (!found) throw conflict('Este aluno não tem pacote com créditos neste local.', 'NO_CREDITS');
      o = found;
    } else {
      const plan = input.plan;
      const total = plan === 'single' ? place.price_single * people : plan === 'pack5' ? place.price_pack5 : place.price_pack10;
      const validity = plan === 'pack5' ? s.pack5_days : plan === 'pack10' ? s.pack10_days : 0;
      [o] = await tx.unsafe<OrderRow[]>(
        `insert into orders (code, student_id, place_id, plan, lessons, people, companion, total_cents, deposit_cents, expires_on, source)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'admin') returning ${ORDER_COLS}`,
        [newCode(), studentId, place.id, plan, PLANS[plan].lessons, plan === 'single' ? people : 1, input.companion || null, total, depositFor(total, s.deposit_pct), validity ? addDays(today(), validity) : null] as never[],
      );
      const amount = input.paid === 'full' ? total : input.paid === 'deposit' ? o.deposit_cents : 0;
      if (amount) {
        await tx`insert into payments (order_id, amount_cents, method, kind, note) values (${o.id}, ${amount}, ${input.method}, ${amount >= total ? 'full' : 'deposit'}, 'Registrado no agendamento pelo instrutor')`;
        await tx`update orders set paid_cents = ${amount}, status = ${amount >= total ? 'paid' : 'active'} where id = ${o.id}`;
      }
    }
    const [b] = await tx.unsafe<BookingRow[]>(
      `insert into bookings (code, order_id, student_id, place_id, date, time, starts_at, people, status, board_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'confirmed',(select board_id from students where id = $3)) returning ${BOOKING_COLS}`,
      [newCode(), o.id, studentId, place.id, input.date, input.time, zonedToUtc(input.date, input.time, TZ), o.plan === 'single' ? people : 1] as never[],
    );
    await event(tx, b.id, 'Agendada pelo instrutor');
    await audit(tx, { actorType: 'ADMIN', actorId: adminId, action: 'BOOKING_CREATED', entity: 'booking', entityId: b.id });
    return b;
  });
  return result;
}

export async function setAttendance(sql: Sql, bookingId: string, status: 'done' | 'no_show' | 'confirmed', adminId: string) {
  const b = await getBooking(sql, bookingId);
  if (!['confirmed', 'done', 'no_show', 'awaiting'].includes(b.status)) throw conflict('Esta aula não está ativa.');
  if (status !== 'confirmed' && new Date(b.starts_at) > new Date()) throw conflict('A presença só pode ser registrada depois do início da aula.');
  await sql`update bookings set status = ${status}, updated_at = now() where id = ${b.id}`;
  await event(sql, b.id, status === 'done' ? 'Aula realizada' : status === 'no_show' ? 'Aluno faltou' : 'Aula confirmada pelo instrutor');
  await audit(sql, { actorType: 'ADMIN', actorId: adminId, action: `BOOKING_${status.toUpperCase()}`, entity: 'booking', entityId: b.id });
  return { ...b, status };
}
