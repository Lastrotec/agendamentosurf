// Previsão do mar: cartões do agendamento, gráfico da maré e a tela "Previsão".
import { useState } from 'react';

import { advice, compass, dayHours, type ForecastData, type ForecastHour, hourAt, lastDate, rate, type Rating, tidePct, tides, tideTrend, waveEnergy, windTone } from '../../shared/forecast';
import { addHour, slotBookable } from '../../shared/slots';
import { useApi } from '../lib/hooks';
import { clock, fmt, fmtLong, fmtShort, nowHourLocal, today } from '../lib/format';
import type { DaySlots, ForecastResponse, Place } from '../lib/types';
import { Icon } from './icons';
import { Btn, PageTitle } from './ui';

export function useForecast(place: string | null) {
  return useApi<ForecastResponse>(place ? `/api/public/forecast/${place}` : null);
}

const hh = (h: number) => String(h).padStart(2, '0') + 'h';
export const m1 = (v: number | null | undefined) => (v == null ? '—' : (Math.round(v * 10) / 10).toLocaleString('pt-BR', { minimumFractionDigits: 1 }));
const range = (vals: number[], f: (n: number) => string | number) => {
  const a = f(Math.min(...vals)), b = f(Math.max(...vals));
  return a === b ? String(a) : `${a}–${b}`;
};
const surf = (h: ForecastHour) => h.surf ?? h.wave;
const sec = (v: number | null | undefined) => (v == null ? '' : `${Math.round(v)}s`);
/** Período primário (de pico), como na tabela do Surfguru; sem ele, o médio. */
const primary = (h: ForecastHour) => h.peakPeriod ?? h.period;
const TONE_LABEL = { terral: 'terral', fraco: 'fraco', cruzado: 'cruzado', maral: 'maral', '': '' } as const;

/** Uma ondulação: altura, período e de onde vem. */
function Train({ h, p, d }: { h: number | null | undefined; p: number | null | undefined; d: number | null | undefined }) {
  if (h == null || h < 0.05) return <span className="fc-none">—</span>;
  return (
    <span className="fc-train">
      <b>{m1(h)}</b>
      <small>{sec(p)} <Dir deg={d ?? null} />{compass(d ?? null)}</small>
    </span>
  );
}

export function Dir({ deg }: { deg: number | null }) {
  if (deg == null) return null;
  return (
    <svg className="dir" viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `rotate(${Math.round(deg)}deg)` }}>
      <path d="M12 4v16m-5-5 5 5 5-5" />
    </svg>
  );
}

export const RatePill = ({ r }: { r: Rating | null }) =>
  r ? (
    <span className={`rate ${r.cls}`}>
      <i />
      {r.label}
    </span>
  ) : null;

export function FcSource({ fc }: { fc: ForecastResponse | null }) {
  if (!fc) return null;
  return (
    <p className="legal-note fc-source">
      <Icon name="info" />{' '}
      {fc.data ? (
        <>
          {fc.data.source || 'Open-Meteo'}. Onda na beira estimada pela exposição de cada pico. Atualizado {fc.fetchedAt ? `às ${clock(fc.fetchedAt)}` : ''}
          {fc.stale ? ' (dados antigos: a próxima coleta está atrasada)' : ''}. Maré modelada. Conferir:{' '}
          <a className="link" href="https://www.marinha.mil.br/chm/tabuas-de-mare" target="_blank" rel="noopener noreferrer">
            tábua da Marinha
          </a>
        </>
      ) : (
        'Previsão do mar indisponível no momento. Ela é atualizada a cada 3 horas.'
      )}
    </p>
  );
}

/** Condições num horário específico (usado no agendamento). */
export function ConditionsCard({ place, date, time, fc, compact }: { place: Place; date: string; time: string; fc: ForecastResponse | null; compact?: boolean }) {
  const data = fc?.data ?? null;
  const hour = Number(time.slice(0, 2));
  if (!fc) return <div className="fc-card loading"><div className="spinner sm" /><p>Carregando a previsão do mar…</p></div>;
  if (!data) return null;
  if (date > lastDate(data)) return <div className="fc-card empty-fc"><Icon name="wave" /><p>A previsão do mar para {fmtShort(date)} fica disponível até 7 dias antes da aula.</p></div>;
  const h = hourAt(data, date, hour);
  if (!h) return null;
  const r = rate(place.facing, h), trend = tideTrend(data, date, hour), pct = tidePct(data, date, hour), tone = windTone(place.facing, h.windDir, h.wind);
  return (
    <div className="fc-card">
      <div className="fc-head">
        <div>
          <div className="eyebrow">PREVISÃO DO MAR</div>
          <h3>Na sua aula · {hh(hour)} às {hh(hour + 1)}</h3>
        </div>
        <RatePill r={r} />
      </div>
      <div className="fc-grid">
        <div><small>ONDULAÇÃO</small><strong>{m1(h.wave)} m</strong><span><Dir deg={h.dir} />{compass(h.dir)} · {Math.round(primary(h) ?? 0)} s</span></div>
        <div><small>NA BEIRA (AULA)</small><strong>~{m1(surf(h))} m</strong><span>estimativa no pico</span></div>
        <div><small>VENTO</small><strong>{h.wind == null ? '—' : `${Math.round(h.wind)} km/h`}</strong><span><Dir deg={h.windDir} />{compass(h.windDir)}{tone && <> · <b className={`wk ${tone}`}>{TONE_LABEL[tone]}</b></>}</span></div>
        <div><small>MARÉ</small><strong>{trend ? trend[0].toUpperCase() + trend.slice(1) : '—'}</strong><span className="tide-bar"><i style={{ width: `${pct ?? 0}%` }} /></span></div>
      </div>
      {!compact && (
        <>
          <p className="fc-advice"><Icon name="leaf" /> {advice(place.facing, h)}</p>
          {h.temp != null && <small className="muted">{Math.round(h.temp)}°C no ar</small>}
        </>
      )}
    </div>
  );
}

export function TideChart({ data, date, lessonHours }: { data: ForecastData; date: string; lessonHours: number[] }) {
  const hs = dayHours(data, date).filter((h) => h.tide != null);
  if (hs.length < 6) return null;
  const W = 640, H = 165, P = 18;
  const lo = Math.min(...hs.map((h) => h.tide!)) - 0.15, hi = Math.max(...hs.map((h) => h.tide!)) + 0.15;
  const x = (hour: number) => P + (hour / 23) * (W - 2 * P);
  const y = (v: number) => H - 44 - ((v - lo) / (hi - lo)) * (H - 70);
  const pts = hs.map((h) => [x(h.hour), y(h.tide!)] as const);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], cx = (x0 + x1) / 2;
    d += ` C${cx} ${y0} ${cx} ${y1} ${x1} ${y1}`;
  }
  const now = date === today() ? nowHourLocal() + new Date().getMinutes() / 60 : null;
  return (
    <svg className="tide-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Gráfico da maré em ${fmt(date)}`}>
      <defs>
        <linearGradient id="tideFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#1f8f8a" stopOpacity=".35" />
          <stop offset="1" stopColor="#1f8f8a" stopOpacity=".02" />
        </linearGradient>
      </defs>
      {lessonHours.map((hr) => <rect key={hr} x={x(hr)} y="8" width={x(hr + 1) - x(hr)} height={H - 34} className="lesson-band" />)}
      <path d={`${d} L${pts.at(-1)![0]} ${H - 26} L${pts[0][0]} ${H - 26} Z`} fill="url(#tideFill)" />
      <path d={d} className="tide-line" />
      {tides(data, date).map((t) => {
        const tx = x(t.minutes / 60), ty = y(t.height);
        return (
          <g key={t.time}>
            <circle cx={tx} cy={ty} r="4" className={`tide-pt ${t.type}`} />
            <text x={tx} y={t.type === 'alta' ? ty - 10 : ty + 18} textAnchor="middle" className="tide-lbl">{t.time}</text>
          </g>
        );
      })}
      {now != null && (
        <>
          <line x1={x(now)} x2={x(now)} y1="6" y2={H - 26} className="now-line" />
          <text x={x(now)} y={H - 30} textAnchor="middle" className="now-lbl">agora</text>
        </>
      )}
      {[0, 3, 6, 9, 12, 15, 18, 21].map((hr) => <text key={hr} x={x(hr)} y={H - 8} textAnchor="middle" className="axis">{hh(hr)}</text>)}
    </svg>
  );
}

/** Resumo do dia escolhido no agendamento. */
export function DayForecastCard({ place, day, fc }: { place: Place; day: DaySlots; fc: ForecastResponse | null }) {
  const data = fc?.data ?? null;
  if (!fc) return <div className="fc-card loading"><div className="spinner sm" /><p>Carregando a previsão do mar…</p></div>;
  if (!data) return null;
  if (day.date > lastDate(data)) return <div className="fc-card empty-fc"><Icon name="wave" /><p>A previsão do mar para {fmtShort(day.date)} fica disponível até 7 dias antes da aula.</p></div>;
  const lessonHours = day.slots.map((s) => Number(s.time.slice(0, 2)));
  const hs = dayHours(data, day.date).filter((h) => lessonHours.includes(h.hour));
  if (!hs.length) return null;
  const rated = hs.map((h) => ({ h, r: rate(place.facing, h)! })).filter((x) => x.r);
  const best = [...rated].sort((a, b) => b.r.score - a.r.score)[0];
  const winds = hs.map((h) => h.wind).filter((v): v is number => v != null);
  return (
    <div className="fc-card fc-day-card">
      <div className="fc-head">
        <div>
          <div className="eyebrow">PREVISÃO DO MAR · {place.short.toUpperCase()}</div>
          <h3>{fmtLong(day.date)}</h3>
        </div>
        <RatePill r={best?.r ?? null} />
      </div>
      <div className="fc-grid">
        <div><small>MELHOR HORÁRIO</small><strong>{best ? hh(best.h.hour) : '—'}</strong><span>{best?.r.label}</span></div>
        <div><small>ONDULAÇÃO NAS AULAS</small><strong>{range(hs.map((h) => h.wave ?? 0), m1)} m</strong><span>{best && <><Dir deg={best.h.dir} />{compass(best.h.dir)} · {Math.round(primary(best.h) ?? 0)} s</>}</span></div>
        <div><small>VENTO</small><strong>{winds.length ? range(winds, Math.round) : '—'} km/h</strong><span>{best && <><Dir deg={best.h.windDir} />{compass(best.h.windDir)}</>}</span></div>
        <div><small>MARÉS</small><strong className="fc-tide-mini">{tides(data, day.date).map((t) => <span key={t.time}>{t.type === 'alta' ? '▲' : '▼'} {t.time}<br /></span>)}</strong></div>
      </div>
      <TideChart data={data} date={day.date} lessonHours={lessonHours} />
    </div>
  );
}

export function SlotForecast({ place, date, time, fc }: { place: Place; date: string; time: string; fc: ForecastResponse | null }) {
  const h = fc?.data ? hourAt(fc.data, date, Number(time.slice(0, 2))) : null;
  const r = rate(place.facing, h);
  if (!h || !r) return null;
  return <span className={`slot-fc ${r.cls}`}><i />{m1(h.wave)} m · {r.label}</span>;
}

/** Tela "Previsão" (aluno e instrutor). */
export function ForecastPage({ places, onBook, slotsFor }: { places: Place[]; onBook?: (place: string, date: string, time: string) => void; slotsFor?: (place: string, date: string) => DaySlots | undefined }) {
  const [spot, setSpot] = useState(places[0]?.id ?? 'jaguaribe');
  const [date, setDate] = useState(today());
  const { data: fc, reload } = useForecast(spot);
  const others = places.map((p) => p.id);
  const p = places.find((x) => x.id === spot)!;
  const data = fc?.data ?? null;
  const days = data ? [...new Set(data.hours.map((h) => h.date))].filter((d) => d >= today()) : [];
  const sel = days.includes(date) ? date : (days[0] ?? date);
  const lessonHours = (d: string) => {
    const s = slotsFor?.(spot, d);
    return s ? s.slots.map((x) => Number(x.time.slice(0, 2))) : p.schedule === 'fixed' ? p.hours.map((t) => Number(t.slice(0, 2))) : [];
  };
  const isClassDay = (d: string) => p.weekdays.includes(new Date(d + 'T12:00:00Z').getUTCDay());
  const dayBest = (d: string) =>
    !data || !isClassDay(d)
      ? null
      : (lessonHours(d)
          .map((hr) => ({ hr, r: rate(p.facing, hourAt(data, d, hr)) }))
          .filter((x): x is { hr: number; r: Rating } => !!x.r)
          .sort((a, b) => b.r.score - a.r.score)[0] ?? null);
  const hours = data ? dayHours(data, sel).filter((h) => h.hour >= 5 && h.hour <= 18) : [];
  const best = dayBest(sel);
  const all = data ? dayHours(data, sel) : [];
  const totals = all.map((h) => h.wave ?? 0);
  const beach = hours.map((h) => surf(h) ?? 0);
  const energies = all.map((h) => waveEnergy(h)).filter((v): v is number => v != null);
  const water = all.map((h) => h.water).filter((v): v is number => v != null);
  const sun = data?.sun?.[sel];
  const daySlots = slotsFor?.(spot, sel);
  return (
    <div className="page-content">
      <PageTitle title="Previsão do mar." sub="Ondulação, vento e maré hora a hora nos picos das aulas." action={<Btn variant="secondary" icon="refresh" onClick={reload}>Atualizar</Btn>} />
      <div className="row between wrap fc-top">
        <div className="seg">
          {others.map((id) => (
            <button key={id} type="button" className={spot === id ? 'active' : ''} onClick={() => setSpot(id)}>
              {places.find((x) => x.id === id)!.short}
            </button>
          ))}
        </div>
      </div>
      {!fc ? (
        <div className="card empty"><div className="spinner" /><h3>Consultando o mar…</h3><p>Buscando ondas, vento e maré.</p></div>
      ) : !data ? (
        <div className="card empty"><Icon name="wave" /><h3>Previsão indisponível agora.</h3><p>A coleta é feita a cada 3 horas. Tente de novo mais tarde.</p></div>
      ) : (
        <>
          <div className="fc-days">
            {days.map((d) => {
              const b = dayBest(d), max = Math.max(...dayHours(data, d).map((h) => h.wave ?? 0));
              return (
                <button key={d} type="button" className={`fc-day ${d === sel ? 'active' : ''}`} onClick={() => setDate(d)}>
                  <small>{fmt(d, { weekday: 'short' }).replace('.', '')} {fmt(d, { day: '2-digit' })}</small>
                  <strong>{m1(max)}<em>m</em></strong>
                  {b ? <><span className={`rate-bar ${b.r.cls}`} /><small>{b.r.label}</small></> : <><span className="rate-bar none" /><small>sem aula</small></>}
                </button>
              );
            })}
          </div>
          <div className="fc-layout">
            <div>
              <section className="card fc-summary">
                <div className="row between wrap">
                  <div><div className="eyebrow">{p.name.toUpperCase()}</div><h2>{fmtLong(sel)}</h2></div>
                  <RatePill r={best?.r ?? null} />
                </div>
                <div className="fc-stats">
                  <div><small>ONDULAÇÃO</small><strong>{totals.length ? range(totals, m1) : '—'} m</strong></div>
                  <div><small>NA BEIRA (AULA)</small><strong>{beach.length ? `~${range(beach, m1)} m` : '—'}</strong></div>
                  <div><small>MELHOR HORÁRIO DE AULA</small><strong>{best ? `${hh(best.hr)} · ${best.r.label}` : 'Sem aula neste dia'}</strong></div>
                  {energies.length > 0 && <div><small>ENERGIA MÁXIMA</small><strong>{Math.max(...energies)} kJ</strong></div>}
                  {water.length > 0 && <div><small>ÁGUA</small><strong>{range(water, Math.round)} °C</strong></div>}
                  {sun && <div><small>SOL</small><strong>{sun.rise} – {sun.set}</strong></div>}
                  <div><small>MARÉS</small><strong className="fc-tide-list">{tides(data, sel).map((t) => `${t.type === 'alta' ? '▲' : '▼'} ${t.time}`).join(' · ') || '—'}</strong></div>
                </div>
                <TideChart data={data} date={sel} lessonHours={isClassDay(sel) ? lessonHours(sel) : []} />
                <p className="legal-note"><span className="legend-band" /> Horários de aula {p.schedule === 'tide' ? 'definidos pela maré' : `em ${p.short}`}</p>
              </section>
              <section className="card fc-table spacer">
                <div className="fc-scroll" tabIndex={0} aria-label="Tabela da previsão hora a hora (role para os lados)">
                  <table>
                    <thead>
                      <tr className="grp">
                        <th rowSpan={2} className="hr">Hora</th>
                        <th rowSpan={2}>Aula</th>
                        <th colSpan={2}>Total</th>
                        <th>Swell 1</th>
                        <th>Swell 2</th>
                        <th>Vagas</th>
                        <th rowSpan={2}>Vento<br /><small>km/h · rajada</small></th>
                        <th rowSpan={2}>Energia<br /><small>kJ</small></th>
                        <th rowSpan={2}>Maré</th>
                        {onBook && <th rowSpan={2}><span className="sr-only">Agendar</span></th>}
                      </tr>
                      <tr className="sub">
                        <th>m</th>
                        <th>período</th>
                        <th>m · s · dir</th>
                        <th>m · s · dir</th>
                        <th>m · s · dir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hours.map((h) => {
                        const r = rate(p.facing, h), lesson = isClassDay(sel) && lessonHours(sel).includes(h.hour), tone = windTone(p.facing, h.windDir, h.wind), trend = tideTrend(data, sel, h.hour);
                        const slot = daySlots?.slots.find((s) => Number(s.time.slice(0, 2)) === h.hour);
                        return (
                          <tr key={h.time} className={lesson ? 'lesson' : ''}>
                            <th scope="row" className="hr">{hh(h.hour)}</th>
                            <td><RatePill r={r} /><small className="fc-beach">~{m1(surf(h))} m na beira</small></td>
                            <td className="fc-total"><b>{m1(h.wave)}</b><Dir deg={h.dir} /><small>{compass(h.dir)}</small></td>
                            <td><b>{sec(primary(h))}</b></td>
                            <td><Train h={h.swell} p={h.swellPeriod} d={h.swellDir} /></td>
                            <td><Train h={h.swell2} p={h.swell2Period} d={h.swell2Dir} /></td>
                            <td><Train h={h.windWave} p={h.windWavePeriod} d={h.windWaveDir} /></td>
                            <td>
                              {h.wind == null ? '—' : (
                                <span className={`fc-wind ${tone}`} title={TONE_LABEL[tone]}>
                                  <Dir deg={h.windDir} />
                                  <b>{Math.round(h.wind)}</b>
                                  {h.gust != null && <small>{Math.round(h.gust)}</small>}
                                  <small>{compass(h.windDir)} {TONE_LABEL[tone]}</small>
                                </span>
                              )}
                            </td>
                            <td><b>{waveEnergy(h) ?? '—'}</b></td>
                            <td>{h.tide == null ? '—' : <>{trend === 'enchendo' ? '↗' : trend === 'secando' ? '↘' : '→'} <small>{m1(h.tide)} m</small></>}</td>
                            {onBook && <td>{slot && slotBookable(slot) ? <button type="button" className="btn small" onClick={() => onBook(spot, sel, slot.time)}>Agendar</button> : lesson ? <small className="muted">aula</small> : null}</td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
            <aside>
              <section className="card">
                <h3>Como ler</h3>
                <div className="legend"><span className="rate great"><i />Excelente</span><span className="rate good"><i />Bom</span><span className="rate fair"><i />Regular</span><span className="rate poor"><i />Difícil</span></div>
                <div className="legend spacer"><b className="wk terral">terral</b><b className="wk fraco">fraco</b><b className="wk cruzado">cruzado</b><b className="wk maral">maral</b></div>
                <p className="muted spacer" style={{ fontSize: 12, lineHeight: 1.7 }}>
                  <strong>Total</strong> é a altura significativa da ondulação no ponto de mar mais próximo do pico, com o período primário. Ela se divide em <strong>swell 1</strong> (principal), <strong>swell 2</strong> e <strong>vagas</strong> (mar do vento local). <strong>Energia</strong> acima de 100 kJ já é surfável na maioria dos picos.
                </p>
                <p className="muted" style={{ fontSize: 12, lineHeight: 1.7 }}>
                  A <strong>nota de aula</strong> usa a onda estimada <strong>na beira</strong> de cada pico (o Farol é mais abrigado que Jaguaribe): de 0,5 a 1,2 m com vento terral ou fraco é o ideal.
                </p>
              </section>
              {onBook && <div className="spacer"><Btn full icon="calendar" onClick={() => onBook(spot, sel, '')}>Agendar uma aula</Btn></div>}
            </aside>
          </div>
          <FcSource fc={fc} />
        </>
      )}
    </div>
  );
}

export { addHour };
