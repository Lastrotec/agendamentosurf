// Configurações e locais (lidos a cada requisição com memória curta no isolate).
import type { Sql, TransactionSql } from 'postgres';

import type { Board, ImageSlot, Place, PublicConfig } from '../../shared/domain';
import { resolveTexts } from '../../shared/domain';
import { notFound } from '../lib/errors';

export interface SettingsRow {
  school: string;
  instructor: string;
  whatsapp: string;
  pix_key: string;
  pix_name: string;
  pix_city: string;
  deposit_pct: number;
  hold_minutes: number;
  auto_confirm: boolean;
  cancel_limit_hours: number;
  reschedule_limit: number;
  reschedule_limit_hours: number;
  min_notice_hours: number;
  horizon_days: number;
  pack5_days: number;
  pack10_days: number;
  remind_student_hours: number[];
  remind_admin_hours: number[];
  remind_morning_at: string | null;
  quiver_enabled: boolean;
  texts: Record<string, unknown>;
  images: Record<string, string>;
  privacy_policy: string;
  terms: string;
  updated_at: Date;
}

export async function loadSettings(sql: Sql): Promise<SettingsRow> {
  const [s] = await sql<SettingsRow[]>`
    select school, instructor, whatsapp, pix_key, pix_name, pix_city, deposit_pct, hold_minutes, auto_confirm,
      cancel_limit_hours, reschedule_limit, reschedule_limit_hours, min_notice_hours, horizon_days, pack5_days, pack10_days,
      to_json(remind_student_hours) as remind_student_hours, to_json(remind_admin_hours) as remind_admin_hours, to_char(remind_morning_at, 'HH24:MI') as remind_morning_at, quiver_enabled,
      texts, images, privacy_policy, terms, updated_at
    from settings where id = 1`;
  if (!s) throw new Error('Configurações não encontradas. Rode o seed do banco.');
  return s;
}

export interface PlaceRow {
  id: string;
  name: string;
  short: string;
  address: string;
  meeting: string;
  description: string;
  modality: string;
  capacity: number;
  weekdays: number[];
  hours: string[];
  schedule: 'fixed' | 'tide';
  price_single: number;
  price_pack5: number;
  price_pack10: number;
  image_id: string | null;
  lat: number;
  lon: number;
  facing: number;
  wave_factor: string | number;
  exposure_from: number;
  exposure_to: number;
  active: boolean;
  sort: number;
}

// Arrays saem como JSON: o driver roda sem busca de tipos (pooler do Supabase) e não converte int[]/text[].
const PLACE_COLS = `id, name, short, address, meeting, description, modality, capacity, to_json(weekdays) as weekdays, to_json(hours) as hours,
  schedule, price_single, price_pack5, price_pack10, image_id, lat, lon, facing, wave_factor, exposure_from, exposure_to, active, sort`;

export async function loadPlaces(sql: Sql | TransactionSql, all = false): Promise<PlaceRow[]> {
  return sql.unsafe<PlaceRow[]>(`select ${PLACE_COLS} from places ${all ? '' : 'where active'} order by sort, id`);
}

export async function getPlace(sql: Sql | TransactionSql, id: string): Promise<PlaceRow> {
  const [p] = await sql.unsafe<PlaceRow[]>(`select ${PLACE_COLS} from places where id = $1`, [id]);
  if (!p) throw notFound('Local não encontrado.');
  return p;
}

export function toPlace(p: PlaceRow): Place {
  return {
    id: p.id,
    name: p.name,
    short: p.short,
    address: p.address,
    meeting: p.meeting,
    description: p.description,
    modality: p.modality,
    capacity: p.capacity,
    weekdays: p.weekdays,
    hours: p.hours,
    schedule: p.schedule,
    prices: { single: p.price_single, pack5: p.price_pack5, pack10: p.price_pack10 },
    imageId: p.image_id,
    facing: p.facing,
  };
}

export const spotModel = (p: PlaceRow) => ({ facing: p.facing, waveFactor: Number(p.wave_factor), exposureFrom: p.exposure_from, exposureTo: p.exposure_to });

export interface BoardRow {
  id: string;
  name: string;
  size: string;
  volume: string;
  type: string;
  level: string;
  description: string;
  image_id: string | null;
  available: boolean;
  condition: 'ok' | 'reparo';
  sort: number;
}

export const toBoard = (b: BoardRow): Board => ({
  id: b.id,
  name: b.name,
  size: b.size,
  volume: b.volume,
  type: b.type,
  level: b.level,
  description: b.description,
  imageId: b.image_id,
  available: b.available,
  condition: b.condition,
});

export function publicConfig(s: SettingsRow): PublicConfig {
  return {
    school: s.school,
    instructor: s.instructor,
    whatsapp: s.whatsapp,
    depositPct: s.deposit_pct,
    holdMinutes: s.hold_minutes,
    cancelLimitHours: s.cancel_limit_hours,
    rescheduleLimit: s.reschedule_limit,
    rescheduleLimitHours: s.reschedule_limit_hours,
    minNoticeHours: s.min_notice_hours,
    horizonDays: s.horizon_days,
    packDays: { pack5: s.pack5_days, pack10: s.pack10_days },
    reminders: { hours: s.remind_student_hours, morning: s.remind_morning_at },
    quiverEnabled: s.quiver_enabled,
    paymentsOnline: false,
    texts: resolveTexts(s.texts),
    images: s.images as Partial<Record<ImageSlot, string>>,
  };
}
