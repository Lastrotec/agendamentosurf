import { useState } from 'react';

import { PLANS } from '../../shared/domain';
import { Icon } from '../components/icons';
import { Btn, PageTitle, Spinner } from '../components/ui';
import { useApi } from '../lib/hooks';
import { fmt, money, today } from '../lib/format';
import { useTitle } from '../lib/router';
import type { OrderView } from '../lib/types';

interface Fin {
  month: string;
  payments: { id: string; amountCents: number; method: string; kind: string; at: string; code: string; plan: string; place: string; student: string }[];
  totals: { received: number; refunded: number; pix: number };
  open: (OrderView & { student: string })[];
}
const KIND = { deposit: 'Sinal', full: 'Total', remaining: 'Restante', refund: 'Devolução' } as Record<string, string>;
const METHOD = { pix: 'Pix', cash: 'Dinheiro', card: 'Cartão', other: 'Outro' } as Record<string, string>;

export function FinancePage() {
  useTitle('Financeiro');
  const [month, setMonth] = useState(today().slice(0, 7));
  const { data } = useApi<Fin>(`/api/admin/finance?month=${month}`);
  return (
    <div className="page-content">
      <PageTitle title="Financeiro." sub="Recebimentos, valores em aberto e devoluções." action={<a className="btn secondary" href={`/api/admin/finance?month=${month}&format=csv`} download>Exportar planilha <Icon name="download" /></a>} />
      <div className="field" style={{ maxWidth: 220 }}><label htmlFor="f-month">Mês</label><input id="f-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
      {!data ? <Spinner /> : (
        <>
          <div className="stats four">
            <div className="card stat"><small>RECEBIDO</small><strong>{money(data.totals.received)}</strong><span>{data.payments.filter((p) => p.amountCents > 0).length} pagamentos</span></div>
            <div className="card stat"><small>VIA PIX</small><strong>{money(data.totals.pix)}</strong><span>no mês</span></div>
            <div className="card stat"><small>DEVOLVIDO</small><strong>{money(data.totals.refunded)}</strong><span>no mês</span></div>
            <div className="card stat alert"><small>A DEVOLVER AGORA</small><strong>{money(data.open.reduce((n, o) => n + o.refundDueCents, 0))}</strong><span>cancelamentos</span></div>
          </div>
          {data.open.length > 0 && (
            <section className="card spacer table-wrap">
              <h3>Em aberto</h3>
              <table className="table spacer">
                <thead><tr><th>Aluno</th><th>Pedido</th><th>Pago</th><th>Falta / devolver</th></tr></thead>
                <tbody>{data.open.map((o) => <tr key={o.id}><td>{o.student}</td><td>{o.planLabel} · {o.code}</td><td>{money(o.paidCents)} de {money(o.totalCents)}</td><td>{o.refundDueCents ? <strong style={{ color: 'var(--orange-dark)' }}>devolver {money(o.refundDueCents)}</strong> : money(o.totalCents - o.paidCents)}</td></tr>)}</tbody>
              </table>
              <p className="legal-note">Para registrar um pagamento ou devolução, abra a aula em Reservas.</p>
            </section>
          )}
          <section className="card spacer table-wrap">
            <h3>Movimentações de {fmt(month + '-15', { month: 'long', year: 'numeric' })}</h3>
            {data.payments.length ? (
              <table className="table spacer">
                <thead><tr><th>Data</th><th>Aluno</th><th>Pedido</th><th>Tipo</th><th>Forma</th><th>Valor</th></tr></thead>
                <tbody>{data.payments.map((p) => <tr key={p.id}><td>{fmt(p.at.slice(0, 10), { day: '2-digit', month: '2-digit' })}</td><td>{p.student}</td><td>{PLANS[p.plan as keyof typeof PLANS]?.label} · {p.place}</td><td>{KIND[p.kind] ?? p.kind}</td><td>{METHOD[p.method] ?? p.method}</td><td><strong>{money(p.amountCents)}</strong></td></tr>)}</tbody>
              </table>
            ) : <p className="muted spacer">Nenhuma movimentação neste mês.</p>}
          </section>
          <div className="spacer"><Btn variant="subtle" onClick={() => setMonth(today().slice(0, 7))}>Mês atual</Btn></div>
        </>
      )}
    </div>
  );
}
