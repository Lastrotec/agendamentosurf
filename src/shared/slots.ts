// Cálculo dos horários de aula de um dia (puro: o servidor passa ocupação, bloqueios e marés).
import type { DaySlots, Place, Slot } from './domain';
import { weekdayOf, zonedToUtc } from './time';

const TZ = 'America/Bahia';
// Maré semidiurna: ~12h25 entre baixa-mares. Referência: baixa-mar observada em Salvador.
const TIDE_REF = Date.parse('2026-10-24T05:52:00-03:00');
const TIDE_PERIOD = 12.4206 * 3600e3;

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Primeira baixa-mar estimada entre 05h e 16h do dia (minutos desde 00:00 local). */
export function estimateLowTide(date: string): number {
  const from = zonedToUtc(date, '05:00', TZ).getTime();
  const to = zonedToUtc(date, '16:00', TZ).getTime();
  let low = TIDE_REF + Math.ceil((from - TIDE_REF) / TIDE_PERIOD) * TIDE_PERIOD;
  if (low > to) low -= TIDE_PERIOD;
  const local = new Date(low - 3 * 3600e3);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

/** Três aulas em volta da maré baixa (a partir de 1 h antes), dentro de 06h–17h. */
export function hoursAroundLow(lowMinutes: number): string[] {
  const start = Math.min(14, Math.max(6, Math.round(lowMinutes / 60) - 1));
  return [0, 1, 2].map((i) => `${String(start + i).padStart(2, '0')}:00`);
}

export interface DayInput {
  place: Pick<Place, 'id' | 'capacity' | 'weekdays' | 'hours' | 'schedule'>;
  date: string;
  now: Date;
  minNoticeHours: number;
  /** Pessoas já reservadas por horário (aulas vivas). */
  taken: Record<string, number>;
  /** Bloqueios: `null` = dia inteiro; senão o horário. */
  blocks: (string | null)[];
  /** Horários definidos pelo instrutor para o dia (sobrepõe a maré). */
  override: string[] | null;
  /** Baixa-mar da previsão do servidor, em minutos locais, se houver. */
  forecastLow: number | null;
}

export function daySlots(i: DayInput): DaySlots {
  const { place, date } = i;
  // Horários definidos pelo instrutor para a data valem mesmo fora dos dias da semana padrão (dia extra).
  const classDay = place.weekdays.includes(weekdayOf(date)) || !!i.override?.length;
  let tide: DaySlots['tide'] = null;
  let hours = place.hours;
  if (i.override) {
    hours = i.override;
    if (place.schedule === 'tide') tide = { period: Number(hours[0]?.slice(0, 2)) < 12 ? 'manhã' : 'tarde', low: null, source: 'instrutor' };
  } else if (place.schedule === 'tide') {
    const low = i.forecastLow ?? estimateLowTide(date);
    hours = hoursAroundLow(low);
    tide = { period: Number(hours[0].slice(0, 2)) < 12 ? 'manhã' : 'tarde', low: hhmm(low), source: i.forecastLow != null ? 'previsão' : 'estimativa' };
  }
  const dayBlocked = i.blocks.includes(null);
  const limit = i.now.getTime() + i.minNoticeHours * 3600e3;
  const slots: Slot[] = classDay
    ? [...hours].sort().map((time) => {
        const taken = i.taken[time] ?? 0;
        return {
          time,
          capacity: place.capacity,
          taken,
          free: Math.max(0, place.capacity - taken),
          blocked: dayBlocked || i.blocks.includes(time),
          closed: zonedToUtc(date, time, TZ).getTime() < limit,
        };
      })
    : [];
  return { date, open: classDay && !dayBlocked && slots.some((s) => !s.blocked && !s.closed && s.free > 0), tide, slots };
}

export const slotBookable = (s: Slot, people = 1) => !s.blocked && !s.closed && s.free >= people;
export const addHour = (t: string) => String(Number(t.slice(0, 2)) + 1).padStart(2, '0') + t.slice(2);
