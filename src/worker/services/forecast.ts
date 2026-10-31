// Coleta da previsão do mar no servidor (Cron a cada 3 h): os alunos leem do banco/borda,
// nunca chamam o serviço externo direto. Sem dados novos, o app mostra a última coleta com a hora
// (ou avisa que está indisponível) — nunca uma simulação.
import type { Sql } from 'postgres';

import { type ForecastData, type ForecastHour, surfAt } from '../../shared/forecast';
import type { Env } from '../env';
import { loadPlaces, type PlaceRow, spotModel } from './settings';

const TZ = 'America/Bahia';
const DAYS = 8;

type Series = Record<string, (number | null)[]>;

async function getJson(f: typeof fetch, url: string): Promise<{ hourly: Series & { time: string[] }; daily?: { time: string[]; sunrise: string[]; sunset: string[] } }> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 12_000);
  try {
    const r = await f(url, { signal: ctl.signal, headers: { 'User-Agent': 'OutsideSurfSchool/1.0' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as never;
  } finally {
    clearTimeout(t);
  }
}

// Ondas: GFS-Wave 0,25° da NOAA (WaveWatch III), o mesmo modelo do Surfguru, com swell 1, swell 2 e vagas.
// Se ele falhar ou vier vazio, cai para a melhor combinação do Open-Meteo (ECMWF WAM / Météo-France) —
// e a fonte gravada diz qual foi usada.
const WAVES_GFS =
  'wave_height,wave_period,wave_peak_period,wave_direction,swell_wave_height,swell_wave_period,swell_wave_direction,' +
  'secondary_swell_wave_height,secondary_swell_wave_period,secondary_swell_wave_direction,wind_wave_height,wind_wave_period,wind_wave_direction';
const WAVES_BEST = 'wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_period,swell_wave_direction,wind_wave_height';
const WIND = 'wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,weather_code';

const hasWaves = (j: { hourly?: Series }) => !!j.hourly?.wave_height?.some((v) => v != null);

export async function fetchSpot(p: PlaceRow, f: typeof fetch = fetch): Promise<ForecastData> {
  const common = `latitude=${p.lat}&longitude=${p.lon}&timezone=${encodeURIComponent(TZ)}&forecast_days=${DAYS}`;
  // cell_selection=sea: célula de mar mais próxima (o pico fica colado na costa e a célula de terra não tem ondas).
  const marineUrl = (q: string) => `https://marine-api.open-meteo.com/v1/marine?${common}&cell_selection=sea&${q}`;
  const [gfsWaves, seaLevel, gfsWind] = await Promise.all([
    getJson(f, marineUrl(`models=ncep_gfswave025&hourly=${WAVES_GFS}`)).catch(() => null),
    // Maré e temperatura da água vêm de outros modelos (o de ondas não tem): pedidos à parte.
    getJson(f, marineUrl('hourly=sea_level_height_msl,sea_surface_temperature')).catch(() => null),
    getJson(f, `https://api.open-meteo.com/v1/forecast?${common}&models=gfs_seamless&hourly=${WIND}&daily=sunrise,sunset&wind_speed_unit=kmh`).catch(() => null),
  ]);
  const gfs = gfsWaves && hasWaves(gfsWaves);
  const marine = gfs && gfsWaves ? gfsWaves : await getJson(f, marineUrl(`hourly=${WAVES_BEST},sea_level_height_msl`));
  const gfsW = !!gfsWind?.hourly?.wind_speed_10m?.some((v) => v != null);
  const weather = gfsW && gfsWind ? gfsWind : await getJson(f, `https://api.open-meteo.com/v1/forecast?${common}&hourly=${WIND}&daily=sunrise,sunset&wind_speed_unit=kmh`);
  const m = marine.hourly, w = weather.hourly;
  const sea = seaLevel?.hourly;
  const idx = new Map(w.time.map((t, i) => [t, i]));
  const seaIdx = new Map((sea?.time ?? []).map((t, i) => [t, i]));
  const model = spotModel(p);
  const r1 = (v: number | null | undefined) => (v == null ? null : Math.round(v * 100) / 100);
  const pick = (s: Series | undefined, k: string, i: number | undefined) => (i == null ? null : (s?.[k]?.[i] ?? null));
  const hours: ForecastHour[] = m.time
    .map((t, i) => {
      const j = idx.get(t), k = seaIdx.get(t);
      const h: ForecastHour = {
        time: t,
        date: t.slice(0, 10),
        hour: Number(t.slice(11, 13)),
        wave: r1(m.wave_height[i]),
        period: r1(m.wave_period[i]),
        peakPeriod: r1(m.wave_peak_period?.[i]),
        dir: m.wave_direction[i] ?? null,
        swell: r1(m.swell_wave_height[i]),
        swellPeriod: r1(m.swell_wave_period[i]),
        swellDir: m.swell_wave_direction[i] ?? null,
        swell2: r1(m.secondary_swell_wave_height?.[i]),
        swell2Period: r1(m.secondary_swell_wave_period?.[i]),
        swell2Dir: m.secondary_swell_wave_direction?.[i] ?? null,
        windWave: r1(m.wind_wave_height?.[i]),
        windWavePeriod: r1(m.wind_wave_period?.[i]),
        windWaveDir: m.wind_wave_direction?.[i] ?? null,
        surf: null,
        tide: r1(pick(sea, 'sea_level_height_msl', k) ?? m.sea_level_height_msl?.[i]),
        wind: pick(w, 'wind_speed_10m', j),
        windDir: pick(w, 'wind_direction_10m', j),
        gust: pick(w, 'wind_gusts_10m', j),
        temp: pick(w, 'temperature_2m', j),
        code: pick(w, 'weather_code', j),
        water: r1(pick(sea, 'sea_surface_temperature', k)),
      };
      h.surf = surfAt(h, model);
      return h;
    })
    .filter((h) => h.wave != null);
  if (!hours.length) throw new Error('Previsão sem dados de ondas');
  const sun: ForecastData['sun'] = {};
  (weather.daily?.time ?? []).forEach((d, i) => (sun[d] = { rise: weather.daily!.sunrise[i].slice(11), set: weather.daily!.sunset[i].slice(11) }));
  const source = [
    gfs ? 'Ondas: NOAA GFS-Wave (WaveWatch III)' : 'Ondas: ECMWF WAM / Météo-France MFWAM (GFS-Wave indisponível nesta coleta)',
    gfsW ? 'vento: NOAA GFS' : 'vento: melhor modelo disponível (GFS indisponível nesta coleta)',
    'maré e água: Open-Meteo',
  ].join('; ');
  return { hours, sun, fetchedAt: new Date().toISOString(), source };
}

/** Atualiza todos os picos; falha de um não apaga a última previsão boa. */
export async function refreshForecasts(sql: Sql, env: Env): Promise<{ ok: string[]; failed: string[] }> {
  const f = env.TEST_FETCH ?? fetch;
  const out = { ok: [] as string[], failed: [] as string[] };
  for (const p of await loadPlaces(sql)) {
    try {
      const data = await fetchSpot(p, f);
      await sql`
        insert into forecasts (place_id, data, fetched_at, ok, error) values (${p.id}, ${sql.json(data as never)}, now(), true, null)
        on conflict (place_id) do update set data = excluded.data, fetched_at = now(), ok = true, error = null`;
      out.ok.push(p.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await sql`
        insert into forecasts (place_id, data, ok, error) values (${p.id}, ${sql.json({ hours: [], sun: {}, fetchedAt: null, source: '' } as never)}, false, ${msg})
        on conflict (place_id) do update set error = excluded.error, ok = (forecasts.data->'hours') <> '[]'::jsonb`;
      out.failed.push(p.id);
    }
  }
  return out;
}

/** Leitura para o app: dados recalculados com a calibração atual do pico (o Romário pode ajustar a qualquer hora). */
export async function readForecast(sql: Sql, p: PlaceRow): Promise<{ data: ForecastData | null; fetchedAt: string | null; stale: boolean }> {
  const [r] = await sql<{ data: ForecastData; fetched_at: Date }[]>`select data, fetched_at from forecasts where place_id = ${p.id}`;
  if (!r || !r.data?.hours?.length) return { data: null, fetchedAt: null, stale: true };
  const model = spotModel(p);
  const data = { ...r.data, hours: r.data.hours.map((h) => ({ ...h, surf: surfAt(h, model) })) };
  return { data, fetchedAt: new Date(r.fetched_at).toISOString(), stale: Date.now() - new Date(r.fetched_at).getTime() > 8 * 3600e3 };
}
