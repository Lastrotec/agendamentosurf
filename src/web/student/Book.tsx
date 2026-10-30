// Agendar (ou remarcar): praia → plano → data e horário → pagamento do sinal pelo Pix.
import { useEffect, useMemo, useState } from 'react';

import { imageUrl, PLANS, type PlanId } from '../../shared/domain';
import { rate, hourAt } from '../../shared/forecast';
import { slotBookable } from '../../shared/slots';
import { ConditionsCard, DayForecastCard, RatePill, SlotForecast, useForecast } from '../components/forecast';
import { Icon } from '../components/icons';
import { Btn, Detail, PageTitle } from '../components/ui';
import { api, errorMessage, newIdempotencyKey } from '../lib/api';
import { addDays, fmt, fmtShort, money, today } from '../lib/format';
import { useApi } from '../lib/hooks';
import { navigate, useSearch, useTitle } from '../lib/router';
import type { BookingView, DaySlots } from '../lib/types';
import { Policies } from './Pages';
import { useStore } from './store';

type PlanChoice = PlanId | 'credit';

export function Book() {
  const { boot, me, requireLogin, reloadMe } = useStore();
  const q = useSearch();
  const rescheduleId = q.get('remarcar');
  const rb = rescheduleId ? me?.bookings.find((b) => b.id === rescheduleId) : undefined;
  useTitle(rb ? 'Remarcar aula' : 'Agendar');
  const c = boot.config;
  const [placeId, setPlaceId] = useState<string | null>(rb?.place ?? q.get('local') ?? (boot.places.length === 1 ? boot.places[0].id : null));
  const [plan, setPlan] = useState<PlanChoice>('single');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [people, setPeople] = useState(1);
  const [companion, setCompanion] = useState('');
  const [start, setStart] = useState(q.get('data') ?? today());
  const [date, setDate] = useState<string | null>(q.get('data'));
  const [time, setTime] = useState<string | null>(q.get('hora') || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idem] = useState(newIdempotencyKey);

  useEffect(() => {
    if (rb) setPlaceId(rb.place);
  }, [rb]);

  const p = boot.places.find((x) => x.id === placeId) ?? null;
  const { data: avail, reload: reloadAvail } = useApi<{ days: DaySlots[]; until: string }>(p ? `/api/public/availability?place=${p.id}&from=${start}&days=14` : null);
  const { data: fc } = useForecast(p?.id ?? null);
  const packs = useMemo(
    () => (me?.orders ?? []).filter((o) => p && o.place === p.id && o.plan !== 'single' && ['active', 'paid'].includes(o.status) && (!o.expiresOn || o.expiresOn >= today()) && o.used < o.lessons),
    [me, p],
  );
  const effPeople = rb ? rb.people : plan === 'single' ? people : 1;
  const day = avail?.days.find((d) => d.date === date);
  const mine = (d: string, t: string) => (me?.bookings ?? []).some((b) => b.id !== rb?.id && b.date === d && b.time === t && ['awaiting', 'confirmed', 'pending_payment'].includes(b.status));
  const total = !p || plan === 'credit' ? 0 : plan === 'single' ? p.prices.single * effPeople : p.prices[plan];
  const deposit = c.depositPct >= 100 ? total : Math.ceil((total * c.depositPct) / 100);
  const ready = !!(p && date && time);
  const days = Array.from({ length: 14 }, (_, i) => addDays(start, i));

  const choosePlace = (id: string) => {
    setPlaceId(id);
    setPlan('single');
    setOrderId(null);
    setPeople(1);
    setDate(null);
    setTime(null);
  };

  const submit = () =>
    requireLogin(async () => {
      if (!p || !date || !time) return;
      setBusy(true);
      setError(null);
      try {
        if (rb) {
          await api(`/api/me/bookings/${rb.id}/reschedule`, { body: { date, time } });
          await reloadMe();
          navigate(`/aulas/${rb.id}`);
          return;
        }
        if (effPeople > 1 && !companion.trim()) throw new Error('Informe o nome de quem vai com você.');
        const r = await api<{ booking: BookingView }>('/api/me/bookings', {
          body: { place: p.id, plan, orderId: plan === 'credit' ? orderId : undefined, people: effPeople, companion: effPeople > 1 ? companion : undefined, date, time, idempotencyKey: idem },
        });
        await reloadMe();
        navigate(r.booking.status === 'pending_payment' ? `/aulas/${r.booking.id}?pagar=1` : `/aulas/${r.booking.id}`);
      } catch (e) {
        setError(errorMessage(e));
        reloadAvail();
      } finally {
        setBusy(false);
      }
    });

  const summary = (
    <div className="card summary">
      <div className="eyebrow">RESUMO</div>
      {p ? (
        <>
          <div className="place-img" style={{ borderRadius: 10, margin: '12px 0' }}><img src={imageUrl(p.imageId, p.id === 'farol' ? '/img/coast.jpg' : '/img/beach.jpg')!} alt="" /></div>
          <h3>{p.name}</h3>
          <Detail label="Plano">{rb ? 'Remarcação' : plan === 'credit' ? 'Crédito do pacote' : PLANS[plan].label}</Detail>
        </>
      ) : (
        <h3 style={{ marginTop: 10 }}>Escolha uma praia para começar</h3>
      )}
      {p && effPeople > 1 && <Detail label="Pessoas">{effPeople}</Detail>}
      {date && <Detail label="Data">{fmt(date, { weekday: 'short', day: 'numeric', month: 'short' })}</Detail>}
      {time && <Detail label="Horário">{time} – {String(Number(time.slice(0, 2)) + 1).padStart(2, '0')}{time.slice(2)}</Detail>}
      {p && date && time && fc?.data && (() => {
        const r = rate(p.facing, hourAt(fc.data, date, Number(time.slice(0, 2))));
        return r ? <Detail label="Mar previsto"><RatePill r={r} /></Detail> : null;
      })()}
      {p && !rb && plan !== 'credit' && (
        <>
          <Detail label="Total">{money(total)}</Detail>
          <div className="detail-row total"><span>Sinal agora ({c.depositPct}%)</span><strong>{money(deposit)}</strong></div>
          {total > deposit && <p className="legal-note">Restante de {money(total - deposit)} até o dia da aula.</p>}
        </>
      )}
      {error && <div className="notice warn spacer" role="alert"><Icon name="info" /><p>{error}</p></div>}
      <Btn full className="spacer" disabled={!ready} busy={busy} icon={rb || plan === 'credit' ? 'check' : 'lock'} onClick={submit}>
        {rb ? 'Confirmar remarcação' : plan === 'credit' ? 'Agendar com crédito' : me ? 'Continuar para o Pix' : 'Criar conta e pagar'}
      </Btn>
      {!rb && plan !== 'credit' && <p className="legal-note spacer"><Icon name="lock" /> Pix direto para o instrutor. O horário fica guardado por {c.holdMinutes} min.</p>}
    </div>
  );

  return (
    <div className="page-content">
      <PageTitle title={rb ? 'Uma nova data, a mesma vontade.' : 'Reserve seu momento no mar.'} sub={rb ? `Remarcação da aula de ${fmtShort(rb.date)} às ${rb.time}.` : 'Escolha a praia, o plano e o horário. O sinal confirma sua vaga.'} />
      {rb && (
        <div className="notice"><Icon name="info" /><p>Remarcando a aula de {fmtShort(rb.date)} às {rb.time} em {boot.places.find((x) => x.id === rb.place)?.short}.</p><button type="button" className="text-btn" onClick={() => navigate('/aulas')}>Desistir</button></div>
      )}
      <div className="booking-layout">
        <div>
          <section className="card step">
            <h3><b>1</b> Onde vamos surfar?</h3>
            <div className="choice-grid">
              {boot.places.map((pl) => (
                <button key={pl.id} type="button" className={`choice ${placeId === pl.id ? 'active' : ''}`} disabled={!!rb} onClick={() => choosePlace(pl.id)}>
                  <img src={imageUrl(pl.imageId, pl.id === 'farol' ? '/img/coast.jpg' : '/img/beach.jpg')!} alt="" />
                  <span><strong>{pl.name}</strong><small>{pl.modality} · {pl.schedule === 'tide' ? 'conforme a maré' : `${pl.hours[0]?.slice(0, 2)}h às ${Number(pl.hours.at(-1)?.slice(0, 2) ?? 11) + 1}h`}</small><em>{money(pl.prices.single)} / aula</em></span>
                </button>
              ))}
            </div>
          </section>

          {p && !rb && (
            <section className="card step">
              <h3><b>2</b> Escolha seu plano</h3>
              <div className="plan-grid">
                {packs.map((o) => (
                  <button key={o.id} type="button" className={`plan ${plan === 'credit' && orderId === o.id ? 'active' : ''}`} onClick={() => (setPlan('credit'), setOrderId(o.id), setPeople(1))}>
                    <span className="badge">USAR CRÉDITO</span>
                    <strong>{o.planLabel}</strong>
                    <small>{o.lessons - o.used} aula(s) restantes{o.expiresOn ? ` · até ${fmt(o.expiresOn, { day: '2-digit', month: '2-digit' })}` : ''}</small>
                    <em>Sem custo</em>
                  </button>
                ))}
                {(Object.keys(PLANS) as PlanId[]).map((k) => (
                  <button key={k} type="button" className={`plan ${plan === k ? 'active' : ''}`} onClick={() => (setPlan(k), setOrderId(null), setTime(null))}>
                    {k === 'pack10' && <span className="badge orange">MELHOR VALOR</span>}
                    <strong>{PLANS[k].label}</strong>
                    <small>{k !== 'single' ? `${money(Math.round(p.prices[k] / PLANS[k].lessons))} por aula · válido ${c.packDays[k]} dias` : '1 hora de aula · prancha inclusa'}</small>
                    <em>{money(p.prices[k])}</em>
                  </button>
                ))}
              </div>
              {p.capacity > 1 && plan === 'single' && (
                <>
                  <div className="people">
                    <span><strong>Quantas pessoas?</strong><small>Aqui a aula pode ser em dupla. Valor por pessoa.</small></span>
                    <div className="seg">
                      {[1, 2].map((n) => <button key={n} type="button" className={people === n ? 'active' : ''} onClick={() => (setPeople(n), setTime(null))}>{n === 1 ? 'Só eu' : 'Em dupla'}</button>)}
                    </div>
                  </div>
                  {people === 2 && (
                    <div className="field"><label htmlFor="bk-companion">Nome de quem vai com você</label><input id="bk-companion" maxLength={60} value={companion} onChange={(e) => setCompanion(e.target.value)} placeholder="Nome completo" /></div>
                  )}
                </>
              )}
              {p.capacity > 1 && plan !== 'single' && <p className="legal-note">Pacotes são individuais. Para aula em dupla, escolha a aula avulsa.</p>}
            </section>
          )}

          {p && (
            <section className="card step">
              <h3><b>{rb ? 2 : 3}</b> Data e horário</h3>
              <div className="date-navigation">
                <strong style={{ fontSize: 12 }}>{fmt(start, { month: 'long', year: 'numeric' })}</strong>
                <div className="row">
                  <button type="button" className="icon-btn" aria-label="Dias anteriores" disabled={start <= today()} onClick={() => setStart(addDays(start, -14) < today() ? today() : addDays(start, -14))}><Icon name="left" /></button>
                  <button type="button" className="icon-btn" aria-label="Próximos dias" disabled={!!avail && addDays(start, 14) > avail.until} onClick={() => setStart(addDays(start, 14))}><Icon name="chevron" /></button>
                </div>
              </div>
              <div className="dates scroll">
                {days.map((d) => {
                  const ad = avail?.days.find((x) => x.date === d);
                  const open = !!ad && ad.slots.some((s) => slotBookable(s, effPeople) && !mine(d, s.time));
                  return (
                    <button key={d} type="button" className={`day ${d === date ? 'active' : ''}`} disabled={!open} onClick={() => (setDate(d), setTime(null))}>
                      <small>{fmt(d, { weekday: 'short' }).replace('.', '')}</small>
                      <strong>{fmt(d, { day: '2-digit' })}</strong>
                      {open && <i />}
                    </button>
                  );
                })}
              </div>
              {day?.tide && (
                <div className="tide-note"><Icon name="tide" /><span>Maré {day.tide.source === 'estimativa' ? 'estimada' : day.tide.source === 'previsão' ? 'pela previsão' : 'definida pelo instrutor'} · aulas pela <strong>{day.tide.period}</strong>{day.tide.low ? ` · maré baixa ~${day.tide.low}` : ''}</span></div>
              )}
              {date && day ? (
                <>
                  <div className="slot-grid">
                    {day.slots.length ? (
                      day.slots.map((s) => {
                        const isMine = mine(day.date, s.time);
                        const ok = slotBookable(s, effPeople) && !isMine;
                        return (
                          <button key={s.time} type="button" className={`slot-btn ${time === s.time ? 'active' : ''}`} disabled={!ok} onClick={() => setTime(s.time)}>
                            <strong>{s.time}</strong>
                            <small>{isMine ? 'Você já tem aula' : s.blocked ? 'Indisponível' : s.closed ? 'Encerrado' : s.free <= 0 ? 'Lotado' : s.free < effPeople ? 'Só 1 vaga' : s.capacity > 1 ? `${s.free} de ${s.capacity} vagas` : 'Disponível'}</small>
                            <SlotForecast place={p} date={day.date} time={s.time} fc={fc} />
                          </button>
                        );
                      })
                    ) : (
                      <p className="muted">Sem horários neste dia.</p>
                    )}
                  </div>
                  <DayForecastCard place={p} day={day} fc={fc} />
                  {time ? <ConditionsCard place={p} date={day.date} time={time} fc={fc} /> : day.slots.length ? <p className="legal-note spacer">Toque em um horário para ver a previsão do mar nessa hora.</p> : null}
                </>
              ) : (
                <p className="muted spacer" style={{ fontSize: 12 }}>{avail ? 'Os dias com bolinha têm horários livres.' : 'Carregando horários…'}</p>
              )}
            </section>
          )}
          <div className="mobile-summary">{summary}</div>
        </div>
        <aside className="booking-side">
          {summary}
          <Policies />
        </aside>
      </div>
    </div>
  );
}
