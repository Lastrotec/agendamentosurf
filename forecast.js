'use strict';
// Previsão do mar por pico: ondas, swell, vento e maré (Open-Meteo Marine + Forecast).
// Dados em cache por 1 hora. Sem internet ou se a API falhar, usa uma simulação
// marcada como tal para o app continuar utilizável.
const Forecast = (() => {
  const TZ = 'America/Bahia', TTL = 3600e3, DAYS = 8;
  // cell_selection=sea: usa a célula de mar mais próxima do modelo (o pico fica colado
  // na costa e a célula "terra" não tem ondas).
  // facing: direção para onde a praia "olha" (de onde vem o mar). Vento soprando
  // de terra para o mar (direção oposta) é terral, o melhor para surfar.
  const SPOTS = {
    jaguaribe: { name: 'Jaguaribe', lat: -12.958, lon: -38.396, facing: 135 },
    farol: { name: 'Farol da Barra', lat: -13.011, lon: -38.533, facing: 190 },
  };
  const memory = {}, pending = {};
  const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'L', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  const compass = deg => COMPASS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
  const angleDiff = (a, b) => { const d = Math.abs(((a - b) % 360 + 360) % 360); return d > 180 ? 360 - d : d; };

  const readCache = id => { try { return JSON.parse(localStorage.getItem('outside-fc-' + id)); } catch { return null; } };
  const writeCache = (id, v) => { try { localStorage.setItem('outside-fc-' + id, JSON.stringify(v)); } catch { /* sem espaço */ } };

  async function fetchReal(spot) {
    const common = `latitude=${spot.lat}&longitude=${spot.lon}&timezone=${encodeURIComponent(TZ)}&forecast_days=${DAYS}`;
    const marineUrl = `https://marine-api.open-meteo.com/v1/marine?${common}&hourly=wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_period,swell_wave_direction,sea_level_height_msl&cell_selection=sea`;
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?${common}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,weather_code&daily=sunrise,sunset&wind_speed_unit=kmh`;
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 12000);
    try {
      const [m, w] = await Promise.all([marineUrl, weatherUrl].map(u => fetch(u, { signal: ctl.signal }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })));
      const mh = m.hourly, wh = w.hourly, idx = new Map(wh.time.map((t, i) => [t, i]));
      const hours = mh.time.map((t, i) => {
        const j = idx.get(t);
        return {
          time: t, date: t.slice(0, 10), hour: +t.slice(11, 13),
          wave: mh.wave_height[i], period: mh.wave_period[i], dir: mh.wave_direction[i],
          swell: mh.swell_wave_height[i], swellPeriod: mh.swell_wave_period[i], swellDir: mh.swell_wave_direction[i],
          tide: mh.sea_level_height_msl[i],
          wind: j == null ? null : wh.wind_speed_10m[j], windDir: j == null ? null : wh.wind_direction_10m[j], gust: j == null ? null : wh.wind_gusts_10m[j],
          temp: j == null ? null : wh.temperature_2m[j], code: j == null ? null : wh.weather_code[j],
        };
      }).filter(h => h.wave != null);
      if (!hours.length) throw new Error('sem dados');
      const sun = Object.fromEntries((w.daily?.time || []).map((d, i) => [d, { rise: w.daily.sunrise[i].slice(11), set: w.daily.sunset[i].slice(11) }]));
      return { hours, sun, simulated: false, at: Date.now() };
    } finally { clearTimeout(timer); }
  }

  // Simulação determinística (mesmo resultado para o mesmo dia).
  function simulate(spotId) {
    const spot = SPOTS[spotId], hours = [], start = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()) + 'T00:00:00-03:00').getTime();
    const ref = Date.parse('2026-10-24T05:52:00-03:00'), period = 12.4206 * 3600e3;
    for (let k = 0; k < DAYS * 24; k++) {
      const ts = start + k * 3600e3, local = new Date(ts - 3 * 3600e3).toISOString(), day = Math.floor(k / 24);
      const wobble = Math.sin(day * 1.7 + (spotId === 'farol' ? 2 : 0)) * 0.35 + Math.sin(k / 9) * 0.08;
      const windDir = spot.facing + 180 + Math.sin(day * 2.3) * 60 + (k % 24 > 11 ? 120 : 0);
      hours.push({
        time: local.slice(0, 16), date: local.slice(0, 10), hour: +local.slice(11, 13),
        wave: Math.max(0.3, +(0.95 + wobble).toFixed(2)), period: +(8 + Math.sin(day) * 2.5).toFixed(1), dir: spot.facing - 20 + Math.sin(day) * 25,
        swell: Math.max(0.2, +(0.8 + wobble).toFixed(2)), swellPeriod: +(9 + Math.sin(day) * 2.5).toFixed(1), swellDir: spot.facing - 15,
        tide: +(1.05 * Math.cos((ts - ref) / period * 2 * Math.PI + Math.PI)).toFixed(2),
        wind: +(8 + (k % 24 > 10 ? 10 : 0) + Math.abs(Math.sin(day * 1.3)) * 8).toFixed(0), windDir: (windDir + 360) % 360, gust: null,
        temp: 25 + Math.round(Math.sin((k % 24 - 8) / 24 * Math.PI * 2) * 3), code: 1,
      });
    }
    return { hours, sun: {}, simulated: true, at: Date.now() };
  }

  async function load(spotId, force = false) {
    const cached = memory[spotId] || readCache(spotId);
    if (cached && !force && Date.now() - cached.at < (cached.simulated ? 10 * 60e3 : TTL)) return (memory[spotId] = cached);
    if (pending[spotId]) return pending[spotId];
    pending[spotId] = (async () => {
      try { memory[spotId] = await fetchReal(SPOTS[spotId]); writeCache(spotId, memory[spotId]); }
      catch { memory[spotId] = cached && !cached.simulated ? cached : simulate(spotId); }
      delete pending[spotId];
      return memory[spotId];
    })();
    return pending[spotId];
  }
  const peek = spotId => memory[spotId] || null;
  const hourAt = (data, date, hour) => data?.hours.find(h => h.date === date && h.hour === hour) || null;
  const dayHours = (data, date) => data ? data.hours.filter(h => h.date === date) : [];
  const lastDate = data => data?.hours.at(-1)?.date;

  // Marés altas e baixas do dia, com o horário refinado por interpolação parabólica.
  function tides(data, date) {
    const hs = data ? data.hours.filter(h => h.date >= date).slice(0, 26) : [];
    const out = [];
    for (let i = 1; i < hs.length - 1; i++) {
      const a = hs[i - 1].tide, b = hs[i].tide, c = hs[i + 1].tide;
      if (hs[i].date !== date || a == null || b == null || c == null) continue;
      const high = b > a && b >= c, low = b < a && b <= c;
      if (!high && !low) continue;
      const denom = a - 2 * b + c, off = denom ? Math.max(-0.5, Math.min(0.5, (a - c) / (2 * denom))) : 0;
      const minutes = Math.round((hs[i].hour + off) * 60);
      out.push({ type: high ? 'alta' : 'baixa', time: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`, minutes, height: b - denom * off * off / 4 });
    }
    return out;
  }
  function tideTrend(data, date, hour) {
    const h = hourAt(data, date, hour), n = hourAt(data, date, hour + 1) || data?.hours[data.hours.indexOf(h) + 1];
    if (!h || !n || h.tide == null || n.tide == null) return null;
    const diff = n.tide - h.tide;
    return Math.abs(diff) < 0.04 ? 'estofo' : diff > 0 ? 'enchendo' : 'secando';
  }
  // Nível da maré em % entre a mínima e a máxima do dia (para a barrinha).
  function tidePct(data, date, hour) {
    const hs = dayHours(data, date).filter(h => h.tide != null), h = hourAt(data, date, hour);
    if (!h || !hs.length) return null;
    const lo = Math.min(...hs.map(x => x.tide)), hi = Math.max(...hs.map(x => x.tide));
    return hi - lo < 0.01 ? 50 : Math.round((h.tide - lo) / (hi - lo) * 100);
  }

  function windKind(spotId, windDir) {
    if (windDir == null) return '';
    const offshore = (SPOTS[spotId].facing + 180) % 360, d = angleDiff(windDir, offshore);
    return d <= 45 ? 'terral' : d >= 135 ? 'maral' : 'lateral';
  }

  // Nota de 0 a 5 pensando em aula (iniciantes e intermediários).
  function rate(spotId, h) {
    if (!h) return null;
    let score = 5;
    const w = h.wave;
    if (w < 0.3) score -= 3; else if (w < 0.5) score -= 1.2; else if (w <= 1.3) score -= 0; else if (w <= 1.8) score -= 1.5; else score -= 3;
    if (h.period >= 9) score += 0.3; else if (h.period < 6) score -= 0.8;
    const kind = windKind(spotId, h.windDir), wind = h.wind ?? 0;
    if (kind === 'terral') score += wind < 25 ? 0.3 : -0.8;
    else if (kind === 'lateral') score -= wind > 20 ? 1.2 : wind > 12 ? 0.5 : 0;
    else score -= wind > 20 ? 2 : wind > 12 ? 1.2 : wind > 6 ? 0.4 : 0;
    score = Math.max(0, Math.min(5, score));
    const label = score >= 4.2 ? 'Excelente' : score >= 3.2 ? 'Bom' : score >= 2.2 ? 'Regular' : 'Difícil';
    const cls = score >= 4.2 ? 'great' : score >= 3.2 ? 'good' : score >= 2.2 ? 'fair' : 'poor';
    return { score: Math.round(score * 10) / 10, label, cls, kind };
  }
  function advice(spotId, h) {
    const r = rate(spotId, h);
    if (!r) return '';
    const parts = [];
    if (h.wave < 0.5) parts.push('mar pequeno, ótimo para quem está começando a ficar em pé');
    else if (h.wave <= 1.3) parts.push('ondas em bom tamanho para aula');
    else parts.push('mar mais forte: a aula fica mais na espuma, perto da areia');
    if (r.kind === 'terral') parts.push('vento terral deixa a onda lisinha');
    else if (r.kind === 'maral' && h.wind > 12) parts.push('vento maral pode deixar o mar mexido');
    return parts.join('; ') + '.';
  }

  return { SPOTS, load, peek, hourAt, dayHours, lastDate, tides, tideTrend, tidePct, rate, advice, compass, windKind };
})();
