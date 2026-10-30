import { describe, expect, it } from 'vitest';

import { breakingHeight, exposure, rate, surfAt, windKind } from '../../src/shared/forecast';
import { pixPayload, crc16 } from '../../src/shared/pix';
import { sanitizeText } from '../../src/shared/schemas';
import { daySlots, estimateLowTide, hoursAroundLow } from '../../src/shared/slots';

const jaguaribe = { facing: 135, waveFactor: 0.9, exposureFrom: 45, exposureTo: 225 };
const farol = { facing: 190, waveFactor: 0.7, exposureFrom: 110, exposureTo: 250 };
const hour = (o: Partial<Parameters<typeof surfAt>[0]>) => ({ wave: 1.2, period: 9, dir: 120, swell: 1, swellPeriod: 10, swellDir: 120, windWave: 0.4, ...o });

describe('motor de ondas', () => {
  it('arrebentação de Komar & Gaughan cresce com período e altura', () => {
    expect(breakingHeight(1, 10)).toBeCloseTo(1.55, 1);
    expect(breakingHeight(1, 14)).toBeGreaterThan(breakingHeight(1, 8));
    expect(breakingHeight(0, 10)).toBe(0);
  });

  it('exposição: swell de leste entra em Jaguaribe e quase não chega ao Farol', () => {
    expect(exposure(100, jaguaribe)).toBe(1);
    expect(exposure(60, farol)).toBeLessThan(0.5);
    expect(exposure(300, jaguaribe)).toBe(0.15);
  });

  it('mesmo mar aberto: onda no Farol (abrigado) menor que em Jaguaribe', () => {
    const h = hour({ swellDir: 90, dir: 90 });
    expect(surfAt(h, farol)!).toBeLessThan(surfAt(h, jaguaribe)!);
    expect(surfAt({ ...h, wave: null }, jaguaribe)).toBeNull();
  });

  it('vento terral, lateral e maral pela orientação da praia', () => {
    expect(windKind(135, 315)).toBe('terral');
    expect(windKind(135, 135)).toBe('maral');
    expect(windKind(135, 45)).toBe('lateral');
  });

  it('nota de aula: onda boa com terral é excelente; mar grande com maral é difícil', () => {
    const base = { time: '', date: '', hour: 8, wave: 1, period: 10, dir: 120, swell: 1, swellPeriod: 10, swellDir: 120, windWave: 0.2, tide: 0, gust: null, temp: 26, code: 1 };
    expect(rate(135, { ...base, surf: 0.9, wind: 8, windDir: 315 })!.label).toBe('Excelente');
    expect(rate(135, { ...base, surf: 2.2, wind: 25, windDir: 135 })!.label).toBe('Difícil');
  });
});

describe('horários', () => {
  it('Farol: três aulas a partir de 1 h antes da maré baixa, dentro de 6h–16h', () => {
    expect(hoursAroundLow(9 * 60 + 10)).toEqual(['08:00', '09:00', '10:00']);
    expect(hoursAroundLow(5 * 60)).toEqual(['06:00', '07:00', '08:00']);
    const low = estimateLowTide('2026-11-02');
    expect(low).toBeGreaterThanOrEqual(5 * 60);
    expect(low).toBeLessThanOrEqual(16 * 60);
  });

  it('bloqueio de dia, lotação e antecedência', () => {
    const place = { id: 'jaguaribe', capacity: 1, weekdays: [0, 1, 3, 4, 5, 6], hours: ['06:00', '07:00'], schedule: 'fixed' as const };
    const now = new Date('2026-11-01T12:00:00-03:00');
    const d = daySlots({ place, date: '2026-11-02', now, minNoticeHours: 2, taken: { '06:00': 1 }, blocks: [], override: null, forecastLow: null });
    expect(d.slots.map((s) => s.free)).toEqual([0, 1]);
    expect(d.open).toBe(true);
    expect(daySlots({ place, date: '2026-11-02', now, minNoticeHours: 2, taken: {}, blocks: [null], override: null, forecastLow: null }).open).toBe(false);
    expect(daySlots({ place, date: '2026-11-03', now, minNoticeHours: 2, taken: {}, blocks: [], override: null, forecastLow: null }).slots).toEqual([]); // terça
    const late = daySlots({ place, date: '2026-11-01', now, minNoticeHours: 2, taken: {}, blocks: [], override: null, forecastLow: null });
    expect(late.slots.every((s) => s.closed)).toBe(true);
  });
});

describe('Pix e sanitização', () => {
  it('BR Code com valor, recebedor sem acento e CRC válido', () => {
    const p = pixPayload({ key: '+5571992208398', name: 'Romário de Jesus Gomes', city: 'Salvador', cents: 7500, txid: 'OSABC123' });
    expect(p).toContain('0114+5571992208398');
    expect(p).toContain('540575.00');
    expect(p).toContain('ROMARIO DE JESUS GOMES');
    expect(crc16(p.slice(0, -4))).toBe(p.slice(-4));
  });

  it('remove HTML, caracteres de controle e direção invertida', () => {
    expect(sanitizeText('  Olá <b>mar</b>‮\u0007  bom ')).toBe('Olá mar bom');
    expect(sanitizeText('linha 1\r\n\n\n\nlinha 2', true)).toBe('linha 1\n\nlinha 2');
  });
});

describe('lembretes', () => {
  it('nada de madrugada: lembrete que cairia entre 22h e 6h sai às 21h30 da véspera', async () => {
    const { reminderMoment } = await import('../../src/worker/services/notify');
    const lesson = new Date('2026-11-05T06:00:00-03:00');
    expect(reminderMoment(lesson, 3).toISOString()).toBe(new Date('2026-11-04T21:30:00-03:00').toISOString());
    expect(reminderMoment(lesson, 24).toISOString()).toBe(new Date('2026-11-04T06:00:00-03:00').toISOString());
    const afternoon = new Date('2026-11-05T15:00:00-03:00');
    expect(reminderMoment(afternoon, 3).toISOString()).toBe(new Date('2026-11-05T12:00:00-03:00').toISOString());
  });
});
