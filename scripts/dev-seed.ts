// SOMENTE desenvolvimento/testes: banco local com dados FICTÍCIOS e uma previsão sintética
// (a rede de testes não alcança o Open-Meteo). Nunca rode em produção.
import postgres from 'postgres';

import { migrate } from './migrate';
import { surfAt, type ForecastData, type ForecastHour } from '../src/shared/forecast';
import { createAdmin } from '../src/worker/services/auth';

const url = process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/outside_e2e';
if (/supabase|pooler/.test(url)) throw new Error('dev-seed não roda em banco de produção.');

export async function devSeed() {
  const a = postgres(url, { max: 1, onnotice: () => {} });
  await a.unsafe('drop schema if exists public cascade; create schema public;');
  await a.end();
  await migrate(url, { seed: true, quiet: true });
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await createAdmin(sql, 'romario@teste.com.br', 'Romário de Jesus', 'senha-segura-123');
  const places = await sql<{ id: string; facing: number; wave_factor: string; exposure_from: number; exposure_to: number }[]>`select id, facing, wave_factor, exposure_from, exposure_to from places`;
  const start = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(new Date()) + 'T00:00:00-03:00').getTime();
  for (const p of places) {
    const hours: ForecastHour[] = [];
    for (let k = 0; k < 8 * 24; k++) {
      const ts = start + k * 3600e3, local = new Date(ts - 3 * 3600e3).toISOString(), day = Math.floor(k / 24);
      const swell = 0.9 + Math.sin(day * 1.3) * 0.35;
      const h: ForecastHour = {
        time: local.slice(0, 13) + ':00', date: local.slice(0, 10), hour: Number(local.slice(11, 13)),
        wave: +(swell + 0.25).toFixed(2), period: +(8 + Math.sin(day) * 2).toFixed(1), dir: 110 + Math.sin(day) * 25,
        swell: +swell.toFixed(2), swellPeriod: +(9 + Math.sin(day) * 2).toFixed(1), swellDir: 115 + Math.sin(day) * 30, windWave: 0.35,
        surf: null, tide: +(1.05 * Math.cos(((ts - Date.parse('2026-10-24T05:52:00-03:00')) / (12.4206 * 3600e3)) * 2 * Math.PI + Math.PI)).toFixed(2),
        wind: 8 + (k % 24 > 10 ? 12 : 0), windDir: (k % 24 > 10 ? 120 : 300), gust: null, temp: 25 + Math.round(Math.sin(((k % 24) - 8) / 24 * Math.PI * 2) * 3), code: 1,
      };
      h.surf = surfAt(h, { facing: p.facing, waveFactor: Number(p.wave_factor), exposureFrom: p.exposure_from, exposureTo: p.exposure_to });
      hours.push(h);
    }
    const data: ForecastData = { hours, sun: {}, fetchedAt: new Date().toISOString(), source: 'sintético (teste)' };
    await sql`insert into forecasts (place_id, data) values (${p.id}, ${sql.json(data as never)}) on conflict (place_id) do update set data = excluded.data, fetched_at = now()`;
  }
  await sql`update settings set min_notice_hours = 0`;
  await sql.end();
}

if (import.meta.url === `file://${process.argv[1]}`) devSeed().then(() => console.log('✔ banco de desenvolvimento pronto'));
