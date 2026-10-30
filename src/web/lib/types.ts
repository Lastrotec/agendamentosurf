import type { Board, BookingStatus, DaySlots, Place, PlanId, PublicConfig } from '../../shared/domain';
import type { ForecastData } from '../../shared/forecast';

export type { Board, BookingStatus, DaySlots, Place, PlanId, PublicConfig };

export interface Bootstrap {
  config: PublicConfig;
  places: Place[];
  boards: Board[];
  today: string;
  pushKey: string | null;
}

export interface OrderView {
  id: string;
  code: string;
  place: string;
  plan: PlanId;
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
  status: 'pending' | 'active' | 'paid' | 'cancelled' | 'expired';
  createdAt: string;
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
  status: BookingStatus;
  holdUntil: string | null;
  pixClaimed: boolean;
  boardId: string | null;
  rescheduled: number;
  reason: string | null;
  cancelledBy: string | null;
  canCancel: boolean;
  canReschedule: boolean;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  bookingId: string | null;
  read: boolean;
  at: string;
}

export interface Me {
  profile: { name: string; phone: string | null; level: string; board: Board | null; since: string };
  bookings: BookingView[];
  orders: OrderView[];
  tips: { id: string; text: string; at: string }[];
  inbox: Notice[];
}

export interface PixInfo {
  orderId: string;
  code: string;
  options: { kind: 'deposit' | 'remaining' | 'full'; cents: number; payload: string }[];
  receiver: string;
  key: string;
}

export interface ForecastResponse {
  place: string;
  data: ForecastData | null;
  fetchedAt: string | null;
  stale: boolean;
}

export const isLive = (b: BookingView, now = Date.now()) =>
  b.status === 'awaiting' || b.status === 'confirmed' || (b.status === 'pending_payment' && (b.pixClaimed || (b.holdUntil ? new Date(b.holdUntil).getTime() > now : false)));
export const byTime = (a: { date: string; time: string }, b: { date: string; time: string }) => (a.date + a.time).localeCompare(b.date + b.time);
