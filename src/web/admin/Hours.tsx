// Horários: criar e organizar a agenda de cada praia — semana padrão, horários de aula, vagas,
// e as exceções (dia fechado, horário bloqueado, dia com horários próprios). Vale na hora para os alunos.
import { useEffect, useMemo, useState } from 'react';

import { Icon } from '../components/icons';
import { Btn, Empty, Modal, PageTitle, Skeleton, useToast } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { useApi } from '../lib/hooks';
import { DAY_NAMES, fmtLong, fmtShort, today } from '../lib/format';
import { useTitle } from '../lib/router';
import type { DaySlots } from '../lib/types';
import { type AdminPlace, placeBody, Stepper, Toggle } from './Settings';

interface Schedule {
  today: string;
  blocks: { id: string; place: string; date: string; time: string | null; reason: string }[];
  overrides: { place: string; date: string; hours: string[] }[];
}
type Draft = Pick<AdminPlace, 'weekdays' | 'hours' | 'schedule' | 'capacity'>;
type ExcKind = 'day' | 'slot' | 'hours';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const CANDIDATE_HOURS = Array.from({ length: 13 }, (_, i) => `${String(5 + i).padStart(2, '0')}:00`);
const sortHours = (h: string[]) => [...new Set(h)].sort();

function WeekAndHours({ place, onSaved }: { place: AdminPlace; onSaved: () => void }) {
  const toast = useToast();
  const initial: Draft = useMemo(() => ({ weekdays: place.weekdays, hours: sortHours(place.hours), schedule: place.schedule, capacity: place.capacity }), [place]);
  const [d, setD] = useState<Draft>(initial);
  const [newHour, setNewHour] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => (setD(initial), setError(null)), [initial]);
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);
  const addHour = () => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(newHour)) return toast('Escolha um horário válido.');
    if (d.hours.includes(newHour)) return toast('Esse horário já existe.');
    if (d.hours.length >= 16) return toast('No máximo 16 horários por dia.');
    setD({ ...d, hours: sortHours([...d.hours, newHour]) });
    setNewHour('');
  };
  const save = async () => {
    setError(null);
    if (!d.weekdays.length) return setError('Marque pelo menos um dia da semana (ou pause o local em Ajustes → Locais).');
    if (d.schedule === 'fixed' && !d.hours.length) return setError('Adicione pelo menos um horário de aula.');
    setBusy(true);
    try {
      await api(`/api/admin/places/${place.id}`, { method: 'PUT', body: placeBody(place, d) });
      toast(`Agenda de ${place.short} salva. Os alunos já veem os novos horários.`);
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="set-grid">
        <section className="card set-card">
          <h3>Semana padrão</h3>
          <p className="sub">Dias em que {place.short} tem aula.</p>
          <div className="week-list">
            {WEEK_ORDER.map((wd) => {
              const on = d.weekdays.includes(wd);
              return (
                <div key={wd} className="week-day">
                  <div>
                    <strong>{cap(DAY_NAMES[wd])}</strong>
                    <small>{on ? (d.schedule === 'tide' ? 'Pela maré' : d.hours.length ? `${d.hours.length} horário${d.hours.length > 1 ? 's' : ''}` : 'Sem horários') : 'Sem aula'}</small>
                  </div>
                  <Toggle label={`Aula ${DAY_NAMES[wd]}`} checked={on} onChange={(v) => setD({ ...d, weekdays: v ? [...d.weekdays, wd].sort() : d.weekdays.filter((x) => x !== wd) })} />
                </div>
              );
            })}
          </div>
        </section>
        <section className="card set-card">
          <h3>Horários de aula</h3>
          <p className="sub">Cada aula dura 1 hora.</p>
          <div className="seg" role="radiogroup" aria-label="Como definir os horários" style={{ alignSelf: 'start', marginBottom: 12 }}>
            <button type="button" role="radio" aria-checked={d.schedule === 'fixed'} className={d.schedule === 'fixed' ? 'active' : ''} onClick={() => setD({ ...d, schedule: 'fixed' })}>Horários fixos</button>
            <button type="button" role="radio" aria-checked={d.schedule === 'tide'} className={d.schedule === 'tide' ? 'active' : ''} onClick={() => setD({ ...d, schedule: 'tide' })}>Pela maré</button>
          </div>
          {d.schedule === 'fixed' ? (
            <>
              {d.hours.length ? (
                <div className="hour-chips">
                  {d.hours.map((h) => (
                    <span key={h} className="hour-chip">
                      {h}
                      <button type="button" aria-label={`Remover ${h}`} onClick={() => setD({ ...d, hours: d.hours.filter((x) => x !== h) })}><Icon name="close" /></button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="muted">Nenhum horário ainda. Adicione o primeiro abaixo.</p>
              )}
              <div className="add-hour">
                <label htmlFor={`nh-${place.id}`} className="sr-only">Novo horário</label>
                <input id={`nh-${place.id}`} type="time" step={900} value={newHour} onChange={(e) => setNewHour(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addHour())} />
                <Btn variant="secondary" icon="plus" onClick={addHour} disabled={!newHour}>Adicionar</Btn>
              </div>
            </>
          ) : (
            <div className="notice"><Icon name="tide" /><div>Três aulas por dia em volta da maré baixa (a partir de 1 h antes), entre 6h e 17h, pela previsão do mar. Para mudar um dia específico, use “Horários especiais num dia”.</div></div>
          )}
          <div className="set-row" style={{ marginTop: 12 }}>
            <div><label htmlFor={`cap-${place.id}`}><strong>Vagas por horário</strong></label><small>Quantas pessoas cabem em cada aula.</small></div>
            <div className="ctrl"><Stepper id={`cap-${place.id}`} value={d.capacity} min={1} max={10} onChange={(n) => setD({ ...d, capacity: n })} /></div>
          </div>
        </section>
      </div>
      {error && <div className="notice warn spacer-sm" role="alert"><Icon name="info" /><div>{error}</div></div>}
      {dirty && (
        <div className="save-bar" role="region" aria-label="Alterações não salvas">
          <span>Agenda de {place.short} alterada</span>
          <div className="row">
            <Btn small variant="secondary" onClick={() => (setD(initial), setError(null))}>Desfazer</Btn>
            <Btn small icon="check" busy={busy} onClick={save}>Salvar</Btn>
          </div>
        </div>
      )}
    </>
  );
}

function ExceptionModal({ kind, places, initialPlace, minDate, onClose, onDone }: { kind: ExcKind; places: AdminPlace[]; initialPlace: string; minDate: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [place, setPlace] = useState(initialPlace);
  const [date, setDate] = useState(minDate);
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [hours, setHours] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: day } = useApi<{ slots: Record<string, DaySlots[]> }>(date >= minDate ? `/api/admin/agenda?from=${date}&days=1` : null);
  const slots = day?.slots[place]?.[0]?.slots ?? [];
  // Horários especiais: começa pelos horários que o dia já teria.
  useEffect(() => setHours(null), [place, date]);
  const sel = hours ?? slots.map((s) => s.time);
  const options = sortHours([...CANDIDATE_HOURS, ...sel]);
  const title = kind === 'day' ? 'Fechar um dia' : kind === 'slot' ? 'Bloquear um horário' : 'Horários especiais num dia';
  const submit = async () => {
    setError(null);
    if (date < minDate) return setError('Escolha hoje ou uma data futura.');
    setBusy(true);
    try {
      if (kind === 'hours') {
        if (!sel.length) throw new Error('Marque pelo menos um horário ou feche o dia.');
        await api('/api/admin/day-hours', { body: { place, date, hours: sel } });
        toast('Horários do dia salvos.');
      } else {
        if (kind === 'slot' && !time) throw new Error('Escolha o horário.');
        await api('/api/admin/blocks', { body: { place, date, time: kind === 'slot' ? time : null, reason } });
        toast(kind === 'day' ? 'Dia fechado. Os alunos não verão horários nesta data.' : `Horário das ${time} bloqueado.`);
      }
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={title} onClose={onClose}>
      <div className="fields">
        <div className="field">
          <label htmlFor="ex-place">Local</label>
          <select id="ex-place" value={place} onChange={(e) => (setPlace(e.target.value), setTime(''))}>
            {places.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ex-date">Data</label>
          <input id="ex-date" type="date" min={minDate} value={date} onChange={(e) => (setDate(e.target.value), setTime(''))} />
        </div>
      </div>
      {date >= minDate && <p className="legal-note">{cap(fmtLong(date))}</p>}
      {kind === 'slot' && (
        <div className="field">
          <label htmlFor="ex-time">Horário</label>
          <select id="ex-time" value={time} onChange={(e) => setTime(e.target.value)}>
            <option value="">{slots.length ? 'Escolha' : 'Sem aulas neste dia'}</option>
            {slots.filter((s) => !s.blocked).map((s) => <option key={s.time} value={s.time}>{s.time}{s.taken ? ` · ${s.taken} marcado(s)` : ''}</option>)}
          </select>
        </div>
      )}
      {kind === 'hours' && (
        <fieldset className="field" style={{ border: 0, padding: 0, margin: '6px 0 0' }}>
          <legend style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Horários de aula neste dia</legend>
          <div className="chips grid">
            {options.map((h) => (
              <label key={h}><input type="checkbox" checked={sel.includes(h)} onChange={(e) => setHours(e.target.checked ? sortHours([...sel, h]) : sel.filter((x) => x !== h))} />{h}</label>
            ))}
          </div>
          <small className="help">Substitui a semana padrão (e a maré) só nesta data. Vale também para abrir um dia extra.</small>
        </fieldset>
      )}
      {kind !== 'hours' && (
        <div className="field">
          <label htmlFor="ex-reason">Motivo (opcional, só você vê)</label>
          <input id="ex-reason" maxLength={120} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={kind === 'day' ? 'Ex.: mar flat, viagem, feriado' : 'Ex.: compromisso'} />
        </div>
      )}
      {kind !== 'hours' && slots.some((s) => s.taken > 0 && (kind === 'day' || s.time === time)) && (
        <div className="notice warn"><Icon name="info" /><div>Já há aula marcada {kind === 'day' ? 'neste dia' : 'neste horário'}. O bloqueio só impede novas reservas: remarque ou cancele a aula na Agenda e avise o aluno.</div></div>
      )}
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="modal-actions">
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn icon="check" busy={busy} variant={kind === 'hours' ? '' : 'danger'} onClick={submit}>{kind === 'hours' ? 'Salvar horários' : kind === 'day' ? 'Fechar o dia' : 'Bloquear'}</Btn>
      </div>
    </Modal>
  );
}

export function HoursPage() {
  useTitle('Horários');
  const toast = useToast();
  const { data: placesData, reload: reloadPlaces } = useApi<{ places: AdminPlace[] }>('/api/admin/places');
  const { data: sched, reload: reloadSched } = useApi<Schedule>('/api/admin/schedule');
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [exc, setExc] = useState<ExcKind | null>(null);
  const places = placesData?.places ?? [];
  const place = places.find((p) => p.id === placeId) ?? places[0];
  if (!placesData || !sched) return <div className="page-content"><PageTitle title="Horários." /><Skeleton rows={3} /></div>;
  if (!place) return <div className="page-content"><PageTitle title="Horários." /><Empty icon="pin" title="Nenhum local cadastrado." text="Cadastre um local para criar a agenda." /></div>;

  const items = [
    ...sched.blocks.filter((b) => b.place === place.id).map((b) => ({ key: `b-${b.id}`, date: b.date, sort: b.time ?? '', title: b.time ? `Horário das ${b.time} bloqueado` : 'Dia fechado', sub: b.reason, remove: () => api(`/api/admin/blocks/${b.id}`, { method: 'DELETE' }), done: 'Liberado.' })),
    ...sched.overrides.filter((o) => o.place === place.id).map((o) => ({ key: `o-${o.date}`, date: o.date, sort: '', title: 'Horários especiais', sub: o.hours.join(' · '), remove: () => api('/api/admin/day-hours', { body: { place: place.id, date: o.date, hours: null } }), done: 'Voltou à semana padrão.' })),
  ].sort((a, b) => (a.date + a.sort).localeCompare(b.date + b.sort));

  const remove = async (it: (typeof items)[number]) => {
    try {
      await it.remove();
      toast(it.done);
      reloadSched();
    } catch (e) {
      toast(errorMessage(e));
    }
  };

  return (
    <div className="page-content">
      <PageTitle title="Horários." sub="Crie e organize os horários de aula de cada praia. Mudanças valem na hora para os alunos." />
      {places.length > 1 && (
        <div className="tabs-scroll" role="tablist" aria-label="Local">
          {places.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={p.id === place.id} className={p.id === place.id ? 'active' : ''} onClick={() => setPlaceId(p.id)}>
              <Icon name="pin" />{p.short}{!p.active && ' (pausado)'}
            </button>
          ))}
        </div>
      )}
      <div className="quick-actions">
        <Btn variant="danger" icon="lock" onClick={() => setExc('day')}>Fechar um dia</Btn>
        <Btn variant="secondary" icon="block" onClick={() => setExc('slot')}>Bloquear um horário</Btn>
        <Btn variant="secondary" icon="clock" onClick={() => setExc('hours')}>Horários especiais num dia</Btn>
      </div>
      <WeekAndHours key={place.id} place={place} onSaved={reloadPlaces} />
      <section className="card set-card spacer">
        <h3>Próximas exceções em {place.short}</h3>
        <p className="sub">Dias fechados, horários bloqueados e dias com horários próprios. Remova para voltar à semana padrão.</p>
        {items.length ? (
          <div className="exc-list">
            {items.map((it) => (
              <div key={it.key} className="exc-item">
                <div>
                  <strong>{cap(fmtShort(it.date))} · {it.title}</strong>
                  {it.sub && <small>{it.sub}</small>}
                </div>
                <Btn small variant="subtle" icon="trash" onClick={() => remove(it)} aria-label={`Remover: ${it.title} em ${fmtShort(it.date)}`}>Remover</Btn>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Nenhuma exceção marcada. A agenda segue a semana padrão.</p>
        )}
      </section>
      {exc && (
        <ExceptionModal
          kind={exc}
          places={places}
          initialPlace={place.id}
          minDate={sched.today || today()}
          onClose={() => setExc(null)}
          onDone={() => (setExc(null), reloadSched())}
        />
      )}
    </div>
  );
}
