import { Icon } from '../components/icons';
import { Btn, Empty, PageTitle, Spinner } from '../components/ui';
import { ago, fmtLong, greeting, money, today } from '../lib/format';
import { useApi } from '../lib/hooks';
import { navigate, useTitle } from '../lib/router';
import type { BookingView, Notice } from '../lib/types';
import { RequestRow } from './Bookings';

interface Dash {
  today: string;
  todays: BookingView[];
  pending: BookingView[];
  upcoming: BookingView[];
  money: { received: number; receivable: number; refunds: number };
  feed: Notice[];
  students: Record<string, { name: string; phone: string | null }>;
}

export function Dashboard({ name }: { name: string }) {
  useTitle('Painel');
  const { data } = useApi<Dash>('/api/admin/dashboard');
  if (!data) return <Spinner />;
  const nm = (b: BookingView) => data.students[b.studentId]?.name ?? '';
  const live = data.todays.filter((b) => b.status !== 'no_show');
  return (
    <div className="page-content">
      <PageTitle title={`${greeting()}, ${name}.`} sub={`${fmtLong(today())} · tudo pronto para a próxima sessão?`} action={<Btn icon="plus" onClick={() => navigate('/painel/agenda?novo=1')}>Novo agendamento</Btn>} />
      <div className="stats four">
        <button type="button" className="card stat" onClick={() => navigate('/painel/agenda')}><small>AULAS HOJE</small><strong>{live.length}</strong><span>{live.length ? live.map((b) => b.time).slice(0, 4).join(' · ') : 'Dia livre'}</span></button>
        <button type="button" className={`card stat ${data.pending.length ? 'alert' : ''}`} onClick={() => navigate('/painel/reservas')}><small>PARA CONFERIR</small><strong>{data.pending.length}</strong><span>{data.pending.length ? 'Pix informados e pedidos' : 'Nada pendente'}</span></button>
        <button type="button" className="card stat" onClick={() => navigate('/painel/financeiro')}><small>RECEBIDO NO MÊS</small><strong>{money(data.money.received)}</strong><span>Pix e outros</span></button>
        <button type="button" className={`card stat ${data.money.refunds ? 'alert' : ''}`} onClick={() => navigate('/painel/financeiro')}><small>{data.money.refunds ? 'A DEVOLVER' : 'A RECEBER'}</small><strong>{money(data.money.refunds || data.money.receivable)}</strong><span>{data.money.refunds ? 'Cancelamentos com reembolso' : 'Restantes de sinais'}</span></button>
      </div>
      <div className="admin-grid">
        <div>
          <div className="section-head"><h2>Para conferir</h2><button type="button" className="text-btn" onClick={() => navigate('/painel/reservas')}>Todas <Icon name="arrow" /></button></div>
          {data.pending.length ? <div className="list-stack">{data.pending.map((b) => <RequestRow key={b.id} b={b} name={nm(b)} />)}</div> : <Empty icon="check" title="Nada pendente." text="Quando um aluno informar um Pix, ele aparece aqui." />}
          <div className="section-head"><h2>Hoje</h2></div>
          {data.todays.length ? <div className="list-stack">{data.todays.map((b) => <RequestRow key={b.id} b={b} name={nm(b)} />)}</div> : <Empty icon="sun" title="Dia livre." text="Nenhuma aula marcada para hoje." />}
          {data.upcoming.length > 0 && (
            <>
              <div className="section-head"><h2>Próximas</h2></div>
              <div className="list-stack">{data.upcoming.map((b) => <RequestRow key={b.id} b={b} name={nm(b)} />)}</div>
            </>
          )}
        </div>
        <aside>
          <section className="card">
            <h3>Atividade</h3>
            <div className="feed spacer">
              {data.feed.length ? data.feed.map((n) => (
                <button key={n.id} type="button" className={`feed-item ${n.read ? '' : 'unread'}`} onClick={() => n.bookingId && navigate(`/painel/aula/${n.bookingId}`)}>
                  <strong>{n.title}</strong><small>{n.body}</small><em>{ago(n.at)}</em>
                </button>
              )) : <p className="muted">Sem atividade ainda.</p>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
