// Agenda por praia: aulas de cada horário, bloqueio de dia/horário, horários do Farol pela maré e agendamento manual.
import { useEffect, useState } from 'react';

import { PLANS, type PlanId } from '../../shared/domain';
import { maskPhoneInput } from '../../shared/phone';
import { Icon } from '../components/icons';
import { Btn, Modal, PageTitle, Spinner, useToast } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { useApi } from '../lib/hooks';
import { addDays, fmt, fmtLong, today } from '../lib/format';
import { navigate, useSearch, useTitle } from '../lib/router';
import type { BookingView, DaySlots, Place } from '../lib/types';
import { statusLabel } from './Bookings';

interface AgendaResp {
  places: Place[];
  slots: Record<string, DaySlots[]>;
  bookings: BookingView[];
  blocks: { id: string; place: string; date: string; time: string | null; reason: string }[];
  overrides: { place: string; date: string; hours: string[] }[];
  students: Record<string, { name: string; phone: string | null }>;
}

function ManualBooking({ preset, onClose, onDone }: { preset: { place?: string; date?: string; time?: string }; onClose: () => void; onDone: () => void }) {
  const { data: agendaPlaces } = useApi<{ places: Place[] }>('/api/admin/places');
  const { data: list } = useApi<{ students: { id: string; name: string; phone: string | null }[] }>('/api/admin/students');
  const [student, setStudent] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [place, setPlace] = useState(preset.place ?? 'jaguaribe');
  const [date, setDate] = useState(preset.date ?? today());
  const [time, setTime] = useState(preset.time ?? '');
  const [plan, setPlan] = useState<PlanId | 'credit'>('single');
  const [people, setPeople] = useState(1);
  const [paid, setPaid] = useState<'none' | 'deposit' | 'full'>('none');
  const [method, setMethod] = useState('pix');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const { data: av } = useApi<{ slots: Record<string, DaySlots[]> }>(`/api/admin/agenda?from=${date}&days=1`);
  const day = av?.slots[place]?.[0];
  const p = agendaPlaces?.places.find((x) => x.id === place);
  return (
    <Modal title="Novo agendamento" onClose={onClose}>
      <div className="field">
        <label htmlFor="mb-student">Aluno</label>
        <select id="mb-student" value={student} onChange={(e) => setStudent(e.target.value)}>
          <option value="">Novo aluno…</option>
          {list?.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {!student && (
        <div className="fields">
          <div className="field"><label htmlFor="mb-name">Nome</label><input id="mb-name" maxLength={60} value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
          <div className="field"><label htmlFor="mb-phone">Celular</label><input id="mb-phone" type="tel" value={newPhone} onChange={(e) => setNewPhone(maskPhoneInput(e.target.value))} placeholder="(71) 99999-9999" /></div>
        </div>
      )}
      <div className="fields">
        <div className="field"><label htmlFor="mb-place">Local</label><select id="mb-place" value={place} onChange={(e) => (setPlace(e.target.value), setTime(''))}>{agendaPlaces?.places.map((x) => <option key={x.id} value={x.id}>{x.short}</option>)}</select></div>
        <div className="field"><label htmlFor="mb-date">Data</label><input id="mb-date" type="date" value={date} onChange={(e) => (setDate(e.target.value), setTime(''))} /></div>
        <div className="field">
          <label htmlFor="mb-time">Horário</label>
          <select id="mb-time" value={time} onChange={(e) => setTime(e.target.value)}>
            <option value="">Escolha</option>
            {day?.slots.filter((s) => s.free > 0 && !s.blocked).map((s) => <option key={s.time} value={s.time}>{s.time} · {s.free} vaga(s)</option>)}
          </select>
        </div>
      </div>
      <div className="fields">
        <div className="field">
          <label htmlFor="mb-plan">Plano</label>
          <select id="mb-plan" value={plan} onChange={(e) => setPlan(e.target.value as PlanId | 'credit')}>
            {(Object.keys(PLANS) as PlanId[]).map((k) => <option key={k} value={k}>{PLANS[k].label}{p ? ` · ${(p.prices[k] / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}</option>)}
            <option value="credit">Usar crédito de pacote do aluno</option>
          </select>
        </div>
        {p && p.capacity > 1 && plan === 'single' && <div className="field"><label htmlFor="mb-people">Pessoas</label><select id="mb-people" value={people} onChange={(e) => setPeople(Number(e.target.value))}>{Array.from({ length: p.capacity }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></div>}
        {plan !== 'credit' && (
          <div className="field">
            <label htmlFor="mb-paid">Pagamento</label>
            <select id="mb-paid" value={paid} onChange={(e) => setPaid(e.target.value as 'none')}>
              <option value="none">Ainda não pagou</option>
              <option value="deposit">Pagou o sinal</option>
              <option value="full">Pagou tudo</option>
            </select>
          </div>
        )}
        {plan !== 'credit' && paid !== 'none' && <div className="field"><label htmlFor="mb-m">Forma</label><select id="mb-m" value={method} onChange={(e) => setMethod(e.target.value)}><option value="pix">Pix</option><option value="cash">Dinheiro</option><option value="card">Cartão</option><option value="other">Outro</option></select></div>}
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="modal-actions">
        <Btn
          icon="check"
          busy={busy}
          disabled={!time}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await api('/api/admin/bookings', { body: { studentId: student || undefined, newStudent: student ? undefined : { name: newName, phone: newPhone }, place, plan, people, date, time, paid, method } });
              toast('Aula agendada e confirmada.');
              onDone();
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Agendar
        </Btn>
      </div>
    </Modal>
  );
}

function DayHoursModal({ place, date, current, onClose, onDone }: { place: Place; date: string; current: string[]; onClose: () => void; onDone: () => void }) {
  const all = Array.from({ length: 12 }, (_, i) => `${String(6 + i).padStart(2, '0')}:00`);
  const [sel, setSel] = useState<string[]>(current);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const save = async (hours: string[] | null) => {
    try {
      await api('/api/admin/day-hours', { body: { place: place.id, date, hours } });
      toast(hours ? 'Horários do dia atualizados.' : 'Voltou a seguir a maré.');
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  return (
    <Modal title={`Horários · ${place.short}`} onClose={onClose}>
      <p className="muted">{fmtLong(date)}. Marque os horários de aula deste dia (substitui a sugestão pela maré).</p>
      <div className="chips spacer">
        {all.map((h) => (
          <label key={h}><input type="checkbox" checked={sel.includes(h)} onChange={(e) => setSel(e.target.checked ? [...sel, h] : sel.filter((x) => x !== h))} />{h}</label>
        ))}
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="modal-actions">
        <Btn variant="secondary" onClick={() => save(null)}>Seguir a maré</Btn>
        <Btn icon="check" onClick={() => save(sel)}>Salvar</Btn>
      </div>
    </Modal>
  );
}

export function AgendaPage() {
  useTitle('Agenda');
  const q = useSearch();
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [start, setStart] = useState(today());
  const [manual, setManual] = useState<{ place?: string; date?: string; time?: string } | null>(q.get('novo') ? {} : null);
  const [hoursFor, setHoursFor] = useState<Place | null>(null);
  const { data, reload } = useApi<AgendaResp>(`/api/admin/agenda?from=${start}&days=7`);
  useEffect(() => {
    if (date < start || date > addDays(start, 6)) setDate(start);
  }, [start, date]);
  if (!data) return <Spinner />;
  const block = async (place: string, time: string | null) => {
    const reason = window.prompt(time ? `Bloquear ${time}? Motivo (opcional):` : 'Bloquear o dia inteiro? Motivo (opcional):', '');
    if (reason === null) return;
    try {
      await api('/api/admin/blocks', { body: { place, date, time, reason } });
      toast('Bloqueado. Alunos não verão este horário.');
      reload();
    } catch (e) {
      toast(errorMessage(e));
    }
  };
  const unblock = async (id: string) => {
    await api(`/api/admin/blocks/${id}`, { method: 'DELETE' });
    toast('Liberado.');
    reload();
  };
  return (
    <div className="page-content">
      <PageTitle title="Agenda." sub="Aulas de cada praia, bloqueios e horários pela maré." action={<Btn icon="plus" onClick={() => setManual({})}>Novo agendamento</Btn>} />
      <div className="row between wrap" style={{ marginBottom: 10 }}>
        <strong>{fmt(start, { month: 'long', year: 'numeric' })}</strong>
        <div className="row">
          <button type="button" className="icon-btn" aria-label="Semana anterior" onClick={() => setStart(addDays(start, -7))}><Icon name="left" /></button>
          <Btn small variant="secondary" onClick={() => (setStart(today()), setDate(today()))}>Hoje</Btn>
          <button type="button" className="icon-btn" aria-label="Próxima semana" onClick={() => setStart(addDays(start, 7))}><Icon name="chevron" /></button>
        </div>
      </div>
      <div className="agenda-days">
        {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) => {
          const n = data.bookings.filter((b) => b.date === d && b.status !== 'pending_payment').length;
          return (
            <button key={d} type="button" className={d === date ? 'active' : ''} onClick={() => setDate(d)}>
              <small>{fmt(d, { weekday: 'short' }).replace('.', '')}</small>
              <strong>{fmt(d, { day: '2-digit' })}</strong>
              <small>{n ? `${n} aula${n > 1 ? 's' : ''}` : '—'}</small>
            </button>
          );
        })}
      </div>
      <h2 style={{ marginBottom: 12 }}>{fmtLong(date)}</h2>
      {data.places.map((p) => {
        const day = data.slots[p.id]?.find((d) => d.date === date);
        const dayBlock = data.blocks.find((b) => b.place === p.id && b.date === date && !b.time);
        const ov = data.overrides.find((o) => o.place === p.id && o.date === date);
        return (
          <section key={p.id} className="card agenda-place">
            <h3>
              <span>{p.name}</span>
              <span className="mini-btns">
                {p.schedule === 'tide' && <button type="button" onClick={() => setHoursFor(p)}>Horários do dia</button>}
                {dayBlock ? <button type="button" onClick={() => unblock(dayBlock.id)}>Liberar o dia</button> : <button type="button" onClick={() => block(p.id, null)}>Bloquear o dia</button>}
              </span>
            </h3>
            {day?.tide && <p className="legal-note"><Icon name="tide" /> {ov ? 'Horários definidos por você' : `Pela maré (${day.tide.source}) · baixa-mar ~${day.tide.low ?? '—'}`}</p>}
            {dayBlock && <p className="notice"><Icon name="block" /> Dia bloqueado{dayBlock.reason ? `: ${dayBlock.reason}` : ''}</p>}
            {!day?.slots.length ? (
              <p className="muted">Sem aulas neste dia da semana.</p>
            ) : (
              day.slots.map((s) => {
                const here = data.bookings.filter((b) => b.place === p.id && b.date === date && b.time === s.time);
                const blk = data.blocks.find((b) => b.place === p.id && b.date === date && b.time === s.time);
                return (
                  <div key={s.time} className={`slot-line ${s.blocked ? 'blocked' : ''}`}>
                    <span className="t">{s.time}</span>
                    <span className="who">
                      {here.length ? here.map((b) => (
                        <button key={b.id} type="button" className={b.status} onClick={() => navigate(`/painel/aula/${b.id}`)}>
                          {data.students[b.studentId]?.name ?? 'Aluno'}{b.people > 1 ? ' +1' : ''} · {statusLabel(b)[0]}
                        </button>
                      )) : <small className="muted">{s.blocked ? `Bloqueado${blk?.reason ? `: ${blk.reason}` : ''}` : `${s.free} de ${s.capacity} livre${s.capacity > 1 ? 's' : ''}`}</small>}
                    </span>
                    <span className="mini-btns">
                      {s.free > 0 && !s.blocked && <button type="button" onClick={() => setManual({ place: p.id, date, time: s.time })}>Agendar</button>}
                      {blk ? <button type="button" onClick={() => unblock(blk.id)}>Liberar</button> : !dayBlock && <button type="button" onClick={() => block(p.id, s.time)}>Bloquear</button>}
                    </span>
                  </div>
                );
              })
            )}
          </section>
        );
      })}
      {manual && <ManualBooking preset={manual} onClose={() => setManual(null)} onDone={() => (setManual(null), reload())} />}
      {hoursFor && <DayHoursModal place={hoursFor} date={date} current={data.slots[hoursFor.id]?.find((d) => d.date === date)?.slots.map((s) => s.time) ?? []} onClose={() => setHoursFor(null)} onDone={() => (setHoursFor(null), reload())} />}
    </div>
  );
}
