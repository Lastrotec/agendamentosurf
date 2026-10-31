import { describe, expect, it } from 'vitest';

import { waveEnergy, wavePower, windTone } from '../../src/shared/forecast';
import { fetchSpot } from '../../src/worker/services/forecast';
import type { PlaceRow } from '../../src/worker/services/settings';

describe('energia e vento como no Surfguru', () => {
  it('energia ~100 kJ para 1 m com 10 s; cresce com o quadrado da altura e do período', () => {
    expect(waveEnergy({ wave: 1, period: 10, peakPeriod: null })).toBe(98);
    expect(waveEnergy({ wave: 2, period: 10, peakPeriod: null })).toBe(392);
    expect(waveEnergy({ wave: 1, period: 8, peakPeriod: 12 })).toBe(141); // usa o período de pico
    expect(waveEnergy({ wave: null, period: 10 })).toBeNull();
    expect(wavePower({ wave: 1, period: 10 })).toBe(4.9);
  });

  it('cor do vento: fraco abaixo de 9 km/h em qualquer direção; senão terral, cruzado ou maral', () => {
    expect(windTone(135, 135, 5)).toBe('fraco');
    expect(windTone(135, 315, 15)).toBe('terral');
    expect(windTone(135, 45, 15)).toBe('cruzado');
    expect(windTone(135, 135, 15)).toBe('maral');
    expect(windTone(135, null, 15)).toBe('');
  });
});

const place = { id: 'jaguaribe', lat: -12.958, lon: -38.396, facing: 135, wave_factor: 0.9, exposure_from: 45, exposure_to: 225 } as unknown as PlaceRow;
const times = ['2026-11-01T06:00', '2026-11-01T07:00'];
const col = (...v: (number | null)[]) => v;
const gfsWaves = {
  hourly: {
    time: times,
    wave_height: col(1.4, 1.5), wave_period: col(7.5, 7.6), wave_peak_period: col(11, 11.2), wave_direction: col(110, 112),
    swell_wave_height: col(1.1, 1.2), swell_wave_period: col(10.5, 10.6), swell_wave_direction: col(150, 150),
    secondary_swell_wave_height: col(0.4, 0.4), secondary_swell_wave_period: col(7, 7), secondary_swell_wave_direction: col(80, 80),
    wind_wave_height: col(0.5, 0.6), wind_wave_period: col(4.2, 4.4), wind_wave_direction: col(95, 96),
  },
};
const sea = { hourly: { time: times, sea_level_height_msl: col(0.6, 0.4), sea_surface_temperature: col(26.4, 26.5) } };
const wind = { hourly: { time: times, wind_speed_10m: col(12, 14), wind_direction_10m: col(300, 310), wind_gusts_10m: col(20, 22), temperature_2m: col(25, 26), weather_code: col(1, 1) }, daily: { time: ['2026-11-01'], sunrise: ['2026-11-01T05:10'], sunset: ['2026-11-01T17:40'] } };
const best = { hourly: { time: times, wave_height: col(1.2, 1.3), wave_period: col(8, 8), wave_direction: col(100, 100), swell_wave_height: col(1, 1), swell_wave_period: col(9, 9), swell_wave_direction: col(120, 120), wind_wave_height: col(0.4, 0.4), sea_level_height_msl: col(0.5, 0.3) } };

function fakeFetch(opts: { gfsDown?: boolean; gfsWindDown?: boolean }) {
  const urls: string[] = [];
  const f = (async (input: string) => {
    const u = String(input);
    urls.push(u);
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
    if (u.includes('marine') && u.includes('ncep_gfswave025')) return opts.gfsDown ? new Response('erro', { status: 502 }) : json(gfsWaves);
    if (u.includes('marine') && u.includes('sea_surface_temperature')) return json(sea);
    if (u.includes('marine')) return json(best);
    if (u.includes('gfs_seamless')) return opts.gfsWindDown ? json({ hourly: { time: times, wind_speed_10m: [null, null] } }) : json(wind);
    return json(wind);
  }) as unknown as typeof fetch;
  return { f, urls };
}

describe('coleta da previsão', () => {
  it('usa GFS-Wave (WaveWatch III) e vento GFS, com swell 1, swell 2, vagas, maré e água', async () => {
    const { f, urls } = fakeFetch({});
    const d = await fetchSpot(place, f);
    expect(urls.some((u) => u.includes('models=ncep_gfswave025'))).toBe(true);
    expect(urls.some((u) => u.includes('models=gfs_seamless'))).toBe(true);
    const h = d.hours[0];
    expect(h).toMatchObject({ wave: 1.4, peakPeriod: 11, swell: 1.1, swell2: 0.4, swell2Dir: 80, windWave: 0.5, windWavePeriod: 4.2, tide: 0.6, water: 26.4, wind: 12, gust: 20 });
    expect(h.surf).toBeGreaterThan(0);
    expect(d.source).toContain('GFS-Wave');
    expect(d.sun['2026-11-01']).toEqual({ rise: '05:10', set: '17:40' });
  });

  it('GFS-Wave fora do ar: cai para a outra fonte e diz isso na origem dos dados', async () => {
    const { f } = fakeFetch({ gfsDown: true, gfsWindDown: true });
    const d = await fetchSpot(place, f);
    expect(d.hours[0]).toMatchObject({ wave: 1.2, swell: 1, wind: 12 });
    expect(d.hours[0].swell2 ?? null).toBeNull();
    expect(d.source).toContain('GFS-Wave indisponível');
    expect(d.source).toContain('GFS indisponível');
  });
});
