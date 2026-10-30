// Minhas aulas: próximas, histórico e detalhe (pagar, remarcar, cancelar).
import { useState } from 'react';

import { STATUS_LABEL } from '../../shared/domain';
import { Icon } from '../components/icons';
import { Btn, Detail, Empty, Modal, PageTitle } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { firstName, fmt, fmtLong, fmtShort, money, whatsappLink } from '../lib/format';
import { navigate, useTitle } from '../lib/router';
import { type BookingView, byTime, isLive } from '../lib/types';
import { BoardImg } from './Pages';
import { CheckoutModal } from './Checkout';
import { placeOf, useStore } from './store';

export const StatusBadge = ({ b }: { b: BookingView }) => {
  const [label, cls] = b.status === 'pending_payment' && b.pixClaimed ? ['Pix em conferência', 'orange'] : STATUS_LABEL[b.status];
  return <span className={`badge ${cls}`}>{label.toUpperCase()}</span>;
};

export function LessonCard({ b }: { b: BookingView }) {
  const { boot, me } = useStore();
  const p = placeOf(boot, b.place);
  const o = me?.orders.find((x) => x.id === b.orderId);
  const pay = b.status === 'pending_payment' && !b.pixClaimed && isLive(b);
  return (
    <article className="card next-class">
      <div className="date-tile"><span>{fmt(b.date, { month: 'short' }).replace('.', '')}</span><strong>{fmt(b.date, { day: '2-digit' })}</strong></div>
      <div className="class-info">
        <StatusBadge b={b} />
        <h3>Aula de surf · {p?.short}</h3>
        <div className="class-meta">
          <span><Icon name="clock" />{b.time} – {b.end}</span>
          <span><Icon name={b.people > 1 ? 'users' : 'user'} />{b.people > 1 ? `${b.people} pessoas` : 'Individual'}</span>
          {o && <span><Icon name="money" />{o.plan === 'single' ? 'Avulsa' : o.planLabel}</span>}
        </div>
      </div>
      {pay ? (
        <Btn icon="lock" onClick={() => navigate(`/aulas/${b.id}?pagar=1`)}>Pagar sinal</Btn>
      ) : (
        <Btn variant="secondary" icon="arrow" onClick={() => navigate(`/aulas/${b.id}`)}>Detalhes</Btn>
      )}
    </article>
  );
}

export function LessonModal({ id, payNow, onClose }: { id: string; payNow?: boolean; onClose: () => void }) {
  const { boot, me, reloadMe } = useStore();
  const [pay, setPay] = useState(!!payNow);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const b = me?.bookings.find((x) => x.id === id);
  if (!b || !me) return null;
  const o = me.orders.find((x) => x.id === b.orderId);
  const p = placeOf(boot, b.place)!;
  const board = boot.config.quiverEnabled ? boot.boards.find((x) => x.id === b.boardId) : undefined;
  const instructor = firstName(boot.config.instructor);
  const owes = o && o.paidCents < o.totalCents && o.status !== 'cancelled';
  if (pay && o) return <CheckoutModal order={o} booking={b} onClose={() => (setPay(false), onClose())} />;

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/me/bookings/${b.id}/cancel`, { body: {} });
      await reloadMe();
      setConfirmCancel(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const paid = o ? o.paidCents - o.refundedCents - o.refundDueCents : 0;

  return (
    <Modal title="Sua sessão no mar" onClose={onClose}>
      <div className="row between"><StatusBadge b={b} /><small className="muted">Reserva {b.code}</small></div>
      <div className="booking-hero">
        {board && <BoardImg b={board} cls="mini" />}
        <div>
          <Detail label="Local">{p.name}</Detail>
          <Detail label="Data">{fmtLong(b.date)}</Detail>
          <Detail label="Horário">{b.time} – {b.end}</Detail>
          <Detail label="Formato">{b.people > 1 ? `Dupla · com ${o?.companion ?? 'acompanhante'}` : 'Individual'}</Detail>
          {boot.config.quiverEnabled && <Detail label="Prancha">{board ? `${board.name} ${board.size}` : 'Definida pelo instrutor'}</Detail>}
        </div>
      </div>
      {o && (
        <div className="pay-box">
          <Detail label="Pedido">{o.planLabel} · {o.code}</Detail>
          <Detail label="Pago">{money(o.paidCents)} de {money(o.totalCents)}</Detail>
          {o.plan !== 'single' && <Detail label="Créditos">{o.lessons - o.used} de {o.lessons} restantes{o.expiresOn ? ` · até ${fmt(o.expiresOn, { day: '2-digit', month: '2-digit' })}` : ''}</Detail>}
          {o.refundDueCents > 0 && <Detail label="A devolver">{money(o.refundDueCents)} (o instrutor faz o Pix de volta)</Detail>}
          {o.refundedCents > 0 && <Detail label="Devolvido">{money(o.refundedCents)}</Detail>}
        </div>
      )}
      {b.status === 'pending_payment' && b.pixClaimed && <div className="notice spacer"><Icon name="clock" /><p>Pix informado! {instructor} vai conferir e confirmar sua aula.</p></div>}
      {b.status === 'awaiting' && <div className="notice spacer"><Icon name="clock" /><p>{instructor} vai confirmar sua aula em breve.</p></div>}
      {b.reason && <div className="notice spacer"><Icon name="info" /><p>{b.reason}</p></div>}
      {isLive(b) && <div className="hint"><Icon name="pin" /> {p.meeting}<br />{boot.config.texts.bringList}</div>}
      {confirmCancel ? (
        <div className="card spacer confirm-box">
          <h3>Cancelar esta aula?</h3>
          <p className="muted">
            {b.status === 'pending_payment'
              ? 'O horário fica livre para outra pessoa.'
              : o?.plan === 'single'
                ? paid > 0
                  ? `${instructor} devolve ${money(paid)} pelo Pix.`
                  : 'Nada foi pago ainda.'
                : 'A aula volta como crédito no seu pacote.'}
          </p>
          {error && <p className="error-text">{error}</p>}
          <div className="modal-actions">
            <Btn variant="secondary" onClick={() => setConfirmCancel(false)}>Voltar</Btn>
            <Btn variant="danger" busy={busy} onClick={cancel}>Cancelar aula</Btn>
          </div>
        </div>
      ) : (
        <div className="modal-actions wrap">
          <a className="btn secondary" href={whatsappLink(boot.config.whatsapp, `Olá ${instructor}! Sobre minha aula ${b.code} de ${fmtShort(b.date)} às ${b.time}.`)} target="_blank" rel="noopener noreferrer">WhatsApp <Icon name="phone" /></a>
          {owes && isLive(b) && !(b.status === 'pending_payment' && b.pixClaimed) && <Btn icon="lock" onClick={() => setPay(true)}>{o!.paidCents ? 'Pagar restante' : 'Pagar sinal'}</Btn>}
          {b.canReschedule && <Btn variant="secondary" icon="calendar" onClick={() => (onClose(), navigate(`/agendar?remarcar=${b.id}`))}>Remarcar</Btn>}
          {b.canCancel && <Btn variant="danger" onClick={() => setConfirmCancel(true)}>Cancelar</Btn>}
          {!b.canCancel && isLive(b) && <span className="legal-note">Cancelamento pelo app até {boot.config.cancelLimitHours} h antes. Depois disso, fale com {instructor}.</span>}
        </div>
      )}
    </Modal>
  );
}

export function LessonsPage() {
  useTitle('Minhas aulas');
  const { me } = useStore();
  const [tab, setTab] = useState<'up' | 'hist'>('up');
  const all = me?.bookings ?? [];
  const up = all.filter((b) => isLive(b) && new Date(b.startsAt).getTime() > Date.now()).sort(byTime);
  const hist = all.filter((b) => !up.includes(b) && b.status !== 'pending_payment').sort(byTime).reverse();
  const list = tab === 'up' ? up : hist;
  return (
    <div className="page-content">
      <PageTitle title="Suas histórias com o mar." sub="Pagamentos, confirmações e o histórico das suas aulas." action={<Btn icon="plus" onClick={() => navigate('/agendar')}>Agendar aula</Btn>} />
      <div className="tabs">
        <button type="button" className={tab === 'up' ? 'active' : ''} onClick={() => setTab('up')}>Próximas ({up.length})</button>
        <button type="button" className={tab === 'hist' ? 'active' : ''} onClick={() => setTab('hist')}>Histórico ({hist.length})</button>
      </div>
      <div className="list-stack">
        {list.length ? list.map((b) => <LessonCard key={b.id} b={b} />) : <Empty icon="wave" title="Nenhuma aula por aqui ainda." text="Sua próxima sessão está a poucos toques." action={<Btn onClick={() => navigate('/agendar')}>Agendar aula</Btn>} />}
      </div>
    </div>
  );
}
