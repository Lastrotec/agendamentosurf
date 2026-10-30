// Reservas: pedidos para conferir, próximas, passadas, canceladas e devoluções + ficha da aula com todas as ações.
import { useState } from 'react';

import { STATUS_LABEL } from '../../shared/domain';
import { formatPhoneBR } from '../../shared/phone';
import { Icon } from '../components/icons';
import { Btn, Detail, Empty, Modal, PageTitle, Spinner, useToast } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { useApi } from '../lib/hooks';
import { clock, fmt, fmtLong, fmtShort, money, whatsappLink } from '../lib/format';
import { navigate, useTitle } from '../lib/router';
import type { Bootstrap, BookingView, DaySlots, OrderView } from '../lib/types';

type Tab = 'pending' | 'upcoming' | 'past' | 'cancelled' | 'refunds';
interface ListResp {
  bookings: BookingView[];
  orders: Record<string, OrderView>;
  students: Record<string, { name: string; phone: string | null }>;
}

export function statusLabel(b: BookingView) {
  return b.status === 'pending_payment' && b.pixClaimed ? (['Pix informado', 'orange'] as const) : STATUS_LABEL[b.status];
}

export function RequestRow({ b, name, order }: { b: BookingView; name: string; order?: OrderView }) {
  const { data: boot } = useApi<Bootstrap>('/api/public/bootstrap');
  const place = boot?.places.find((p) => p.id === b.place);
  const [label, cls] = statusLabel(b);
  return (
    <button type="button" className="card next-class as-btn" style={{ width: '100%', textAlign: 'left' }} onClick={() => navigate(`/painel/aula/${b.id}`)}>
      <div className="date-tile"><span>{fmt(b.date, { month: 'short' }).replace('.', '')}</span><strong>{fmt(b.date, { day: '2-digit' })}</strong></div>
      <div className="class-info">
        <span className={`badge ${cls}`}>{label.toUpperCase()}</span>
        <h3>{name} · {place?.short}</h3>
        <div className="class-meta">
          <span><Icon name="clock" />{b.time}</span>
          <span><Icon name={b.people > 1 ? 'users' : 'user'} />{b.people > 1 ? 'Dupla' : 'Individual'}</span>
          {order && <span><Icon name="money" />{order.planLabel} · {money(order.paidCents)} de {money(order.totalCents)}{order.refundDueCents ? ` · devolver ${money(order.refundDueCents)}` : ''}</span>}
        </div>
      </div>
      <Icon name="chevron" />
    </button>
  );
}

export function BookingsPage() {
  useTitle('Reservas');
  const [tab, setTab] = useState<Tab>('pending');
  const { data, loading } = useApi<ListResp>(`/api/admin/bookings?tab=${tab}`);
  const tabs: [Tab, string][] = [['pending', 'Para conferir'], ['upcoming', 'Próximas'], ['past', 'Passadas'], ['cancelled', 'Canceladas'], ['refunds', 'Devoluções']];
  return (
    <div className="page-content">
      <PageTitle title="Reservas." sub="Confira os Pix informados, confirme as aulas e acompanhe as devoluções." action={<Btn icon="plus" onClick={() => navigate('/painel/agenda?novo=1')}>Novo agendamento</Btn>} />
      <div className="tabs">{tabs.map(([k, l]) => <button key={k} type="button" className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {!data && loading ? (
        <Spinner />
      ) : data?.bookings.length ? (
        <div className="list-stack">{data.bookings.map((b) => <RequestRow key={b.id} b={b} name={data.students[b.studentId]?.name ?? ''} order={data.orders[b.orderId]} />)}</div>
      ) : (
        <Empty icon="list" title="Nada por aqui." text={tab === 'pending' ? 'Nenhum pagamento ou pedido esperando você.' : 'Nenhuma reserva nesta lista.'} />
      )}
    </div>
  );
}

interface SheetResp {
  booking: BookingView;
  order: OrderView;
  student: { id: string; name: string; phone: string | null; level: string; board_id: string | null };
  events: { text: string; at: string }[];
  payments: { id: string; amountCents: number; method: string; kind: string; note: string | null; at: string }[];
}

const METHODS = { pix: 'Pix', cash: 'Dinheiro', card: 'Cartão', other: 'Outro' } as const;

export function BookingSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const toast = useToast();
  const { data, reload } = useApi<SheetResp>(`/api/admin/bookings/${id}`);
  const { data: boot } = useApi<Bootstrap>('/api/public/bootstrap');
  const { data: boards } = useApi<{ boards: { id: string; name: string; size: string; available: boolean }[] }>('/api/admin/boards');
  const [mode, setMode] = useState<'view' | 'pay' | 'decline' | 'move'>('view');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<keyof typeof METHODS>('pix');
  const [reason, setReason] = useState('');
  const [moveDate, setMoveDate] = useState('');
  const [moveTime, setMoveTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: moveAvail } = useApi<{ days: DaySlots[] }>(mode === 'move' && moveDate && data ? `/api/public/availability?place=${data.booking.place}&from=${moveDate}&days=1` : null);

  if (!data || !boot) return <Modal title="Aula" onClose={onClose}><Spinner /></Modal>;
  const { booking: b, order: o, student: st } = data;
  const place = boot.places.find((p) => p.id === b.place)!;
  const [label, cls] = statusLabel(b);
  const live = ['pending_payment', 'awaiting', 'confirmed'].includes(b.status);
  const started = new Date(b.startsAt).getTime() <= Date.now();
  const due = o.totalCents - o.paidCents;
  const depositDue = Math.max(0, o.depositCents - o.paidCents);

  const act = async (fn: () => Promise<unknown>, ok: string, close = false) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      toast(ok);
      setMode('view');
      if (close) onClose();
      else reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const pay = (cents: number, m: keyof typeof METHODS = 'pix') => act(() => api(`/api/admin/orders/${o.id}/payments`, { body: { amountCents: cents, method: m } }), `Pagamento de ${money(cents)} registrado. Aluno avisado.`);

  return (
    <Modal title="Aula" onClose={onClose} className="wide">
      <div className="row between"><span className={`badge ${cls}`}>{label.toUpperCase()}</span><small className="muted">Reserva {b.code} · pedido {o.code}</small></div>
      <div className="sheet-section">
        <Detail label="Aluno">{st.name}</Detail>
        {st.phone && <Detail label="Celular"><a className="link" href={whatsappLink(st.phone, `Olá ${st.name.split(' ')[0]}! Sobre sua aula de ${fmtShort(b.date)} às ${b.time}.`)} target="_blank" rel="noopener noreferrer">{formatPhoneBR(st.phone)} · WhatsApp</a></Detail>}
        <Detail label="Local">{place.name}</Detail>
        <Detail label="Data">{fmtLong(b.date)} · {b.time}–{b.end}</Detail>
        <Detail label="Formato">{b.people > 1 ? `Dupla · com ${o.companion ?? '—'}` : 'Individual'}</Detail>
        <Detail label="Nível">{st.level}</Detail>
      </div>
      <div className="pay-box">
        <Detail label="Plano">{o.planLabel}{o.plan !== 'single' ? ` · ${o.used}/${o.lessons} aulas usadas` : ''}</Detail>
        <Detail label="Pago">{money(o.paidCents)} de {money(o.totalCents)}</Detail>
        {o.refundDueCents > 0 && <Detail label="A devolver">{money(o.refundDueCents)}</Detail>}
        {o.refundedCents > 0 && <Detail label="Devolvido">{money(o.refundedCents)}</Detail>}
      </div>
      {b.status === 'pending_payment' && b.pixClaimed && <div className="notice spacer"><Icon name="info" /><p>O aluno informou que fez o Pix. Confira no app do banco e registre abaixo.</p></div>}
      {b.reason && <div className="notice spacer"><Icon name="info" /><p>{b.reason}</p></div>}
      {error && <div className="notice warn spacer"><Icon name="info" /><p>{error}</p></div>}

      {mode === 'view' && (
        <div className="req-actions">
          {o.refundDueCents > 0 && <Btn icon="check" busy={busy} onClick={() => act(() => api(`/api/admin/orders/${o.id}/refunded`, { body: { method: 'pix' } }), 'Devolução registrada. Aluno avisado.')}>Marquei como devolvido ({money(o.refundDueCents)})</Btn>}
          {live && b.status === 'pending_payment' && depositDue > 0 && <Btn icon="check" busy={busy} onClick={() => pay(depositDue)}>Pix do sinal recebido · {money(depositDue)}</Btn>}
          {live && b.status === 'pending_payment' && due > depositDue && <Btn variant="secondary" busy={busy} onClick={() => pay(due)}>Recebi o total · {money(due)}</Btn>}
          {b.status === 'awaiting' && <Btn icon="check" busy={busy} onClick={() => act(() => api(`/api/admin/bookings/${b.id}/confirm`, { body: {} }), 'Aula confirmada. Aluno avisado.')}>Confirmar aula</Btn>}
          {o.status !== 'cancelled' && due > 0 && b.status !== 'pending_payment' && <Btn variant="secondary" icon="money" onClick={() => (setAmount((due / 100).toFixed(2).replace('.', ',')), setMode('pay'))}>Registrar pagamento</Btn>}
          {b.status === 'pending_payment' && <Btn variant="subtle" onClick={() => (setAmount((depositDue / 100).toFixed(2).replace('.', ',')), setMode('pay'))}>Outro valor/forma</Btn>}
          {live && <Btn variant="secondary" icon="calendar" onClick={() => (setMoveDate(b.date), setMoveTime(''), setMode('move'))}>Remarcar</Btn>}
          {live && <Btn variant="danger" onClick={() => (setReason(b.status === 'confirmed' ? 'Infelizmente as condições do mar não permitem a aula neste horário.' : 'Não consigo atender neste horário. Que tal escolher outro?'), setMode('decline'))}>{b.status === 'confirmed' ? 'Cancelar aula' : 'Recusar'}</Btn>}
          {started && ['confirmed', 'done', 'no_show'].includes(b.status) && (
            <>
              <Btn variant={b.status === 'done' ? '' : 'secondary'} busy={busy} onClick={() => act(() => api(`/api/admin/bookings/${b.id}/attend`, { body: { status: 'done' } }), 'Aula registrada como realizada.')}>Realizada</Btn>
              <Btn variant={b.status === 'no_show' ? 'danger' : 'secondary'} busy={busy} onClick={() => act(() => api(`/api/admin/bookings/${b.id}/attend`, { body: { status: 'no_show' } }), 'Falta registrada.')}>Faltou</Btn>
            </>
          )}
          <Btn variant="subtle" icon="user" onClick={() => (onClose(), navigate(`/painel/alunos?id=${st.id}`))}>Ficha do aluno</Btn>
        </div>
      )}

      {mode === 'pay' && (
        <div className="card spacer confirm-box">
          <h3>Registrar pagamento</h3>
          <div className="fields">
            <div className="field"><label htmlFor="pay-amt">Valor (R$)</label><input id="pay-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="field"><label htmlFor="pay-m">Forma</label><select id="pay-m" value={method} onChange={(e) => setMethod(e.target.value as keyof typeof METHODS)}>{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          </div>
          <div className="modal-actions">
            <Btn variant="secondary" onClick={() => setMode('view')}>Voltar</Btn>
            <Btn busy={busy} icon="check" onClick={() => {
              const cents = Math.round(Number(amount.replace(/\./g, '').replace(',', '.')) * 100);
              if (!cents || cents < 1) return setError('Informe um valor válido.');
              void pay(cents, method);
            }}>Registrar</Btn>
          </div>
        </div>
      )}

      {mode === 'decline' && (
        <div className="card spacer confirm-box">
          <h3>{b.status === 'confirmed' ? 'Cancelar esta aula?' : 'Recusar este pedido?'}</h3>
          <p className="muted">O aluno recebe a mensagem{o.plan === 'single' ? (o.paidCents ? ` e fica registrado ${money(o.paidCents - o.refundedCents)} a devolver` : '') : ' e a aula volta como crédito no pacote'}.</p>
          <div className="field"><label htmlFor="dec-r">Mensagem para o aluno</label><textarea id="dec-r" maxLength={400} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <div className="modal-actions">
            <Btn variant="secondary" onClick={() => setMode('view')}>Voltar</Btn>
            <Btn variant="danger" busy={busy} onClick={() => act(() => api(`/api/admin/bookings/${b.id}/decline`, { body: { reason } }), 'Feito. Aluno avisado.')}>{b.status === 'confirmed' ? 'Cancelar e avisar' : 'Recusar e avisar'}</Btn>
          </div>
        </div>
      )}

      {mode === 'move' && (
        <div className="card spacer confirm-box">
          <h3>Remarcar aula</h3>
          <div className="fields">
            <div className="field"><label htmlFor="mv-d">Nova data</label><input id="mv-d" type="date" value={moveDate} onChange={(e) => (setMoveDate(e.target.value), setMoveTime(''))} /></div>
            <div className="field">
              <label htmlFor="mv-t">Horário</label>
              <select id="mv-t" value={moveTime} onChange={(e) => setMoveTime(e.target.value)}>
                <option value="">Escolha</option>
                {moveAvail?.days[0]?.slots.filter((s) => !s.blocked && (s.free >= b.people || (moveDate === b.date && s.time === b.time))).map((s) => <option key={s.time} value={s.time}>{s.time} · {s.free} vaga(s)</option>)}
              </select>
            </div>
          </div>
          <p className="legal-note">Remarcações feitas por você não contam no limite do aluno.</p>
          <div className="modal-actions">
            <Btn variant="secondary" onClick={() => setMode('view')}>Voltar</Btn>
            <Btn busy={busy} disabled={!moveTime} icon="check" onClick={() => act(() => api(`/api/admin/bookings/${b.id}/move`, { body: { date: moveDate, time: moveTime } }), 'Aula remarcada e aluno avisado.')}>Remarcar e avisar</Btn>
          </div>
        </div>
      )}

      {boot.config.quiverEnabled && boards && boards.boards.length > 0 && live && (
        <div className="sheet-section">
          <h4>Prancha da aula</h4>
          <select
            aria-label="Prancha da aula"
            value={b.boardId ?? ''}
            onChange={(e) => act(() => api(`/api/admin/bookings/${b.id}/board`, { body: { boardId: e.target.value || null } }), 'Prancha definida.')}
          >
            <option value="">A definir</option>
            {boards.boards.map((x) => <option key={x.id} value={x.id}>{x.name} {x.size}{x.available ? '' : ' (só do instrutor)'}</option>)}
          </select>
        </div>
      )}

      {data.payments.length > 0 && (
        <div className="sheet-section">
          <h4>Pagamentos</h4>
          <div className="events">{data.payments.map((p) => <div key={p.id}><span>{money(p.amountCents)} · {METHODS[p.method as keyof typeof METHODS] ?? p.method}{p.kind === 'refund' ? ' · devolução' : ''}</span><small>{fmt(p.at.slice(0, 10), { day: '2-digit', month: '2-digit' })} {clock(p.at)}</small></div>)}</div>
        </div>
      )}
      <div className="sheet-section">
        <h4>Histórico</h4>
        <div className="events">{data.events.map((e, i) => <div key={i}><span>{e.text}</span><small>{fmt(e.at.slice(0, 10), { day: '2-digit', month: '2-digit' })} {clock(e.at)}</small></div>)}</div>
      </div>
    </Modal>
  );
}
