// Formato das respostas da API (o que o app recebe). Nada além do necessário para cada tela.
import { LIVE_STATUSES, PLANS } from '../../shared/domain';
import { pixPayload } from '../../shared/pix';
import { addHour } from '../../shared/slots';
import { type BookingRow, hoursUntil, type OrderRow } from './bookings';
import type { SettingsRow } from './settings';

export interface OrderView {
  id: string;
  code: string;
  place: string;
  plan: OrderRow['plan'];
  planLabel: string;
  lessons: number;
  used: number;
  people: number;
  companion: string | null;
  totalCents: number;
  depositCents: number;
  paidCents: number;
  refundDueCents: number;
  refundedCents: number;
  expiresOn: string | null;
  status: OrderRow['status'];
  createdAt: string;
}

export function orderView(o: OrderRow, used = 0): OrderView {
  return {
    id: o.id,
    code: o.code,
    place: o.place_id,
    plan: o.plan,
    planLabel: PLANS[o.plan].label,
    lessons: o.lessons,
    used,
    people: o.people,
    companion: o.companion,
    totalCents: o.total_cents,
    depositCents: o.deposit_cents,
    paidCents: o.paid_cents,
    refundDueCents: o.refund_due_cents,
    refundedCents: o.refunded_cents,
    expiresOn: o.expires_on,
    status: o.status,
    createdAt: new Date(o.created_at).toISOString(),
  };
}

export interface BookingView {
  id: string;
  code: string;
  orderId: string;
  studentId: string;
  place: string;
  date: string;
  time: string;
  end: string;
  startsAt: string;
  people: number;
  status: BookingRow['status'];
  holdUntil: string | null;
  pixClaimed: boolean;
  boardId: string | null;
  rescheduled: number;
  reason: string | null;
  cancelledBy: string | null;
  canCancel: boolean;
  canReschedule: boolean;
}

export function bookingView(b: BookingRow, s: SettingsRow, now = new Date()): BookingView {
  const live = LIVE_STATUSES.includes(b.status as never) && new Date(b.starts_at) > now;
  const h = hoursUntil(b, now);
  return {
    id: b.id,
    code: b.code,
    orderId: b.order_id,
    studentId: b.student_id,
    place: b.place_id,
    date: b.date,
    time: b.time,
    end: addHour(b.time),
    startsAt: new Date(b.starts_at).toISOString(),
    people: b.people,
    status: b.status,
    holdUntil: b.hold_until ? new Date(b.hold_until).toISOString() : null,
    pixClaimed: !!b.pix_claimed_at,
    boardId: s.quiver_enabled ? b.board_id : null,
    rescheduled: b.rescheduled,
    reason: b.reason,
    cancelledBy: b.cancelled_by,
    canCancel: live && (b.status === 'pending_payment' || h >= s.cancel_limit_hours),
    canReschedule: live && b.status !== 'pending_payment' && b.rescheduled < s.reschedule_limit && h >= s.reschedule_limit_hours,
  };
}

/** Quanto falta pagar agora (sinal ou restante) e o Pix copia e cola com esse valor. */
export function pixFor(o: OrderRow, s: SettingsRow) {
  const due = o.paid_cents < o.deposit_cents ? o.deposit_cents - o.paid_cents : o.total_cents - o.paid_cents;
  const full = o.total_cents - o.paid_cents;
  const make = (cents: number) => pixPayload({ key: s.pix_key, name: s.pix_name, city: s.pix_city, cents, txid: o.code });
  return {
    orderId: o.id,
    code: o.code,
    options: due > 0 ? [{ kind: o.paid_cents < o.deposit_cents ? 'deposit' : 'remaining', cents: due, payload: make(due) }, ...(full > due ? [{ kind: 'full', cents: full, payload: make(full) }] : [])] : [],
    receiver: s.pix_name,
    key: s.pix_key,
  };
}
