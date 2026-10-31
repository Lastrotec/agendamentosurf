// Motor de ondas. Referência: Surfguru — mesmos modelos (ondas do WaveWatch III/NOAA GFS-Wave, vento do
// NOAA GFS) e mesma leitura: altura total, período e direção, ondulações separadas (swell 1, swell 2 e
// vagas), vento com rajada e cor pela direção na praia, energia e potência das ondas, maré.
// Por cima disso: a onda estimada na beira de cada pico e uma nota pensando em aula.
// Puro: roda igual no servidor (ao gravar) e no app (ao exibir).

export interface ForecastHour {
  time: string; // YYYY-MM-DDTHH:00 (hora local)
  date: string;
  hour: number;
  wave: number | null; // altura total (significativa) no ponto do modelo (m)
  period: number | null; // período médio (s)
  peakPeriod?: number | null; // período de pico (s): o "período primário" da tabela
  dir: number | null;
  swell: number | null; // swell 1 (ondulação principal)
  swellPeriod: number | null;
  swellDir: number | null;
  swell2?: number | null; // swell 2 (ondulação secundária)
  swell2Period?: number | null;
  swell2Dir?: number | null;
  windWave: number | null; // vagas (mar de vento local)
  windWavePeriod?: number | null;
  windWaveDir?: number | null;
  surf: number | null; // onda estimada quebrando no pico (m)
  tide: number | null; // nível do mar em relação ao médio (m)
  wind: number | null; // km/h
  windDir: number | null;
  gust: number | null;
  temp: number | null;
  code: number | null;
  water?: number | null; // temperatura da água (°C)
}

export interface ForecastData {
  hours: ForecastHour[];
  sun: Record<string, { rise: string; set: string }>;
  fetchedAt: string;
  source: string;
}

export interface SpotModel {
  facing: number; // para onde a praia "olha"
  waveFactor: number; // calibração do pico (0,1–1,5)
  exposureFrom: number; // janela de direções que entram no pico (sentido horário)
  exposureTo: number;
}

const G = 9.81;
const RHO = 1025; // densidade da água do mar (kg/m³)
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'L', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
export const compass = (deg: number | null) => (deg == null ? '' : COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16]);
export const angleDiff = (a: number, b: number) => {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
};

/** Quanto de uma ondulação vinda de `dir` entra no pico (1 dentro da janela, cai até 0,15 a 60° fora). */
export function exposure(dir: number | null, m: SpotModel): number {
  if (dir == null) return 0.6;
  const from = ((m.exposureFrom % 360) + 360) % 360;
  const to = ((m.exposureTo % 360) + 360) % 360;
  const d = ((dir % 360) + 360) % 360;
  const inside = from <= to ? d >= from && d <= to : d >= from || d <= to;
  if (inside) return 1;
  const off = Math.min(angleDiff(d, from), angleDiff(d, to));
  return Math.max(0.15, Math.cos(Math.min(90, (off / 60) * 90) * (Math.PI / 180)));
}

/** Altura de arrebentação (Komar & Gaughan, 1972): Hb = 0,39·g^(1/5)·(T·H0²)^(2/5). */
export function breakingHeight(h0: number, period: number): number {
  if (h0 <= 0 || period <= 0) return 0;
  return 0.39 * G ** 0.2 * (period * h0 * h0) ** 0.4;
}

/** Onda estimada no pico, somando swell e mar de vento já filtrados pela exposição. */
export function surfAt(h: Pick<ForecastHour, 'wave' | 'period' | 'dir' | 'swell' | 'swellPeriod' | 'swellDir' | 'windWave'>, m: SpotModel): number | null {
  if (h.wave == null) return null;
  const swell = h.swell ?? 0;
  const windSea = h.windWave ?? Math.sqrt(Math.max(0, h.wave ** 2 - swell ** 2));
  const hs = breakingHeight(swell * exposure(h.swellDir ?? h.dir, m), h.swellPeriod ?? h.period ?? 8);
  const hw = breakingHeight(windSea * exposure(h.dir, m), Math.min(h.period ?? 5, 7));
  return Math.round(Math.sqrt(hs * hs + hw * hw) * m.waveFactor * 100) / 100;
}

/** Período usado nas contas de energia: o de pico (primário), senão o médio. */
const energyPeriod = (h: Pick<ForecastHour, 'period' | 'peakPeriod'>) => h.peakPeriod ?? h.period ?? null;

/**
 * Energia da onda pela teoria linear (como o Surfguru explica): densidade E = ρ·g·H²/16 (J/m²) somada
 * ao longo de um comprimento de onda em águas profundas, L = g·T²/2π. Resultado em kJ por metro de crista:
 * cerca de 100 kJ (1 m com 10 s) já é surfável na maioria dos picos.
 */
export function waveEnergy(h: Pick<ForecastHour, 'wave' | 'period' | 'peakPeriod'>): number | null {
  const t = energyPeriod(h);
  if (h.wave == null || t == null) return null;
  return Math.round(((RHO * G * h.wave ** 2) / 16) * ((G * t * t) / (2 * Math.PI)) / 1000);
}

/** Potência (fluxo de energia) por metro de frente de onda: P = ρ·g²·H²·T / 64π, em kW/m. */
export function wavePower(h: Pick<ForecastHour, 'wave' | 'period' | 'peakPeriod'>): number | null {
  const t = energyPeriod(h);
  if (h.wave == null || t == null) return null;
  return Math.round(((RHO * G * G * h.wave ** 2 * t) / (64 * Math.PI) / 1000) * 10) / 10;
}

export const hourAt = (d: ForecastData | null, date: string, hour: number) => d?.hours.find((h) => h.date === date && h.hour === hour) ?? null;
export const dayHours = (d: ForecastData | null, date: string) => (d ? d.hours.filter((h) => h.date === date) : []);
export const lastDate = (d: ForecastData | null) => d?.hours.at(-1)?.date ?? '';

export interface TideExtreme {
  type: 'alta' | 'baixa';
  time: string;
  minutes: number;
  height: number;
}

/** Marés altas e baixas do dia, com horário refinado por interpolação parabólica. */
export function tides(d: ForecastData | null, date: string): TideExtreme[] {
  const hs = d ? d.hours.filter((h) => h.date >= date).slice(0, 26) : [];
  const out: TideExtreme[] = [];
  for (let i = 1; i < hs.length - 1; i++) {
    const a = hs[i - 1].tide, b = hs[i].tide, c = hs[i + 1].tide;
    if (hs[i].date !== date || a == null || b == null || c == null) continue;
    const high = b > a && b >= c, low = b < a && b <= c;
    if (!high && !low) continue;
    const denom = a - 2 * b + c;
    const off = denom ? Math.max(-0.5, Math.min(0.5, (a - c) / (2 * denom))) : 0;
    const minutes = Math.round((hs[i].hour + off) * 60);
    out.push({
      type: high ? 'alta' : 'baixa',
      time: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
      minutes,
      height: b - (denom * off * off) / 4,
    });
  }
  return out;
}

/** Baixa-mar do dia entre 05h e 16h (para os horários do Farol). */
export function lowTideMinutes(d: ForecastData | null, date: string): number | null {
  const low = tides(d, date).find((t) => t.type === 'baixa' && t.minutes >= 5 * 60 && t.minutes <= 16 * 60);
  return low ? low.minutes : null;
}

export function tideTrend(d: ForecastData | null, date: string, hour: number): 'enchendo' | 'secando' | 'estofo' | null {
  const h = hourAt(d, date, hour);
  if (!h || !d) return null;
  const n = d.hours[d.hours.indexOf(h) + 1];
  if (!n || h.tide == null || n.tide == null) return null;
  const diff = n.tide - h.tide;
  return Math.abs(diff) < 0.04 ? 'estofo' : diff > 0 ? 'enchendo' : 'secando';
}

export function tidePct(d: ForecastData | null, date: string, hour: number): number | null {
  const hs = dayHours(d, date).filter((x) => x.tide != null);
  const h = hourAt(d, date, hour);
  if (!h || h.tide == null || !hs.length) return null;
  const lo = Math.min(...hs.map((x) => x.tide!)), hi = Math.max(...hs.map((x) => x.tide!));
  return hi - lo < 0.01 ? 50 : Math.round(((h.tide - lo) / (hi - lo)) * 100);
}

export type WindKind = 'terral' | 'lateral' | 'maral' | '';
export function windKind(facing: number, windDir: number | null): WindKind {
  if (windDir == null) return '';
  const d = angleDiff(windDir, (facing + 180) % 360);
  return d <= 45 ? 'terral' : d >= 135 ? 'maral' : 'lateral';
}

/**
 * Cor do vento como no Surfguru: verde terral, azul fraco (qualquer direção), laranja cruzado, vermelho maral.
 * Fraco: abaixo de 9 km/h (~5 nós), quando a direção quase não muda a onda.
 */
export type WindTone = 'terral' | 'fraco' | 'cruzado' | 'maral' | '';
export function windTone(facing: number, windDir: number | null, speed: number | null): WindTone {
  if (windDir == null || speed == null) return '';
  if (speed < 9) return 'fraco';
  const k = windKind(facing, windDir);
  return k === 'lateral' ? 'cruzado' : k;
}

export interface Rating {
  score: number;
  label: 'Excelente' | 'Bom' | 'Regular' | 'Difícil';
  cls: 'great' | 'good' | 'fair' | 'poor';
  kind: WindKind;
}

/** Nota de 0 a 5 pensando em aula (iniciantes e intermediários), pela onda estimada no pico. */
export function rate(facing: number, h: ForecastHour | null): Rating | null {
  if (!h || (h.surf ?? h.wave) == null) return null;
  const w = (h.surf ?? h.wave)!;
  let score = 5;
  if (w < 0.25) score -= 3;
  else if (w < 0.45) score -= 1.2;
  else if (w <= 1.2) score -= 0;
  else if (w <= 1.7) score -= 1.5;
  else score -= 3;
  const p = h.swellPeriod ?? h.period ?? 0;
  if (p >= 9) score += 0.3;
  else if (p < 6) score -= 0.8;
  const kind = windKind(facing, h.windDir);
  const wind = h.wind ?? 0;
  if (kind === 'terral') score += wind < 25 ? 0.3 : -0.8;
  else if (kind === 'lateral') score -= wind > 20 ? 1.2 : wind > 12 ? 0.5 : 0;
  else score -= wind > 20 ? 2 : wind > 12 ? 1.2 : wind > 6 ? 0.4 : 0;
  score = Math.max(0, Math.min(5, score));
  const label = score >= 4.2 ? 'Excelente' : score >= 3.2 ? 'Bom' : score >= 2.2 ? 'Regular' : 'Difícil';
  const cls = score >= 4.2 ? 'great' : score >= 3.2 ? 'good' : score >= 2.2 ? 'fair' : 'poor';
  return { score: Math.round(score * 10) / 10, label, cls, kind };
}

export function advice(facing: number, h: ForecastHour | null): string {
  const r = rate(facing, h);
  if (!r || !h) return '';
  const w = (h.surf ?? h.wave)!;
  const parts: string[] = [];
  if (w < 0.45) parts.push('mar pequeno, ótimo para quem está começando a ficar em pé');
  else if (w <= 1.2) parts.push('ondas em bom tamanho para aula');
  else parts.push('mar mais forte: a aula fica mais na espuma, perto da areia');
  if (r.kind === 'terral') parts.push('vento terral deixa a onda lisinha');
  else if (r.kind === 'maral' && (h.wind ?? 0) > 12) parts.push('vento maral pode deixar o mar mexido');
  const s = parts.join('; ') + '.';
  return s[0].toUpperCase() + s.slice(1);
}
