// Utilitários de data/hora com fuso explícito (padrão America/Bahia, UTC-3 sem horário de verão).
// Não dependemos do fuso do servidor: toda conversão passa por Intl.

export const DEFAULT_TZ = 'America/Bahia';

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface ZonedParts {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  weekday: number; // 0 = domingo
  minutes: number; // minutos desde 00:00 local
}

export function zonedParts(instant: Date, tz = DEFAULT_TZ): ZonedParts {
  const p: Record<string, string> = {};
  for (const part of partsFormatter(tz).formatToParts(instant)) p[part.type] = part.value;
  const hour = p.hour === '24' ? '00' : p.hour;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${hour}:${p.minute}`,
    weekday: WEEKDAYS[p.weekday] ?? 0,
    minutes: Number(hour) * 60 + Number(p.minute),
  };
}

// Cache de deslocamento por fuso e hora UTC: transições de horário de verão acontecem em horas cheias,
// então o resultado é exato e evita chamadas caras ao Intl (importante no limite de CPU do Workers Free).
const offsetCache = new Map<string, number>();

function offsetMinutes(instant: Date, tz: string): number {
  const key = `${tz}|${Math.floor(instant.getTime() / 3_600_000)}`;
  const hit = offsetCache.get(key);
  if (hit !== undefined) return hit;
  const v = computeOffsetMinutes(instant, tz);
  if (offsetCache.size > 20_000) offsetCache.clear();
  offsetCache.set(key, v);
  return v;
}

function computeOffsetMinutes(instant: Date, tz: string): number {
  const p: Record<string, string> = {};
  for (const part of partsFormatter(tz).formatToParts(instant)) p[part.type] = part.value;
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour === '24' ? '0' : p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

/** Converte data + hora de parede no fuso informado para um instante UTC. */
export function zonedToUtc(date: string, time: string, tz = DEFAULT_TZ): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = offsetMinutes(new Date(guess), tz);
  let t = guess - off1 * 60000;
  const off2 = offsetMinutes(new Date(t), tz);
  if (off2 !== off1) t = guess - off2 * 60000;
  return new Date(t);
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function isValidDateString(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function diffDays(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

const WEEKDAY_NAMES = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const WEEKDAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function weekdayName(weekday: number, short = false): string {
  return (short ? WEEKDAY_SHORT : WEEKDAY_NAMES)[weekday] ?? '';
}

export function monthName(month1: number): string {
  return MONTHS[month1 - 1] ?? '';
}

/** "30/10/2026" */
export function formatDateBR(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

/** "sexta-feira, 30 de outubro" */
export function formatDateLong(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${weekdayName(weekdayOf(date))}, ${d} de ${monthName(m)}`;
}

// Aquece o ICU no carregamento do módulo (conta no tempo de inicialização do isolate, não na CPU da requisição).
try {
  partsFormatter(DEFAULT_TZ).formatToParts(new Date(0));
} catch {
  /* ambiente sem ICU completo: segue sem aquecimento */
}
