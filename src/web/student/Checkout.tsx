// Pagamento por Pix (copia e cola + QR Code com o valor exato). O aluno avisa "já fiz o Pix" e o
// instrutor confere no banco e confirma no painel. Quando o gateway for definido, a confirmação passa a ser automática.
import qrcode from 'qrcode-generator';
import { useEffect, useMemo, useState } from 'react';

import { Icon } from '../components/icons';
import { Btn, Detail, Modal } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { useApi } from '../lib/hooks';
import { firstName, fmtShort, money } from '../lib/format';
import type { BookingView, OrderView, PixInfo } from '../lib/types';
import { placeOf, useStore } from './store';

function QrSvg({ text }: { text: string }) {
  const svg = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }, [text]);
  // SVG gerado aqui mesmo a partir do código Pix (não vem de usuário nem do banco).
  return <div className="qr-box" role="img" aria-label="QR Code Pix" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function Countdown({ until }: { until: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, new Date(until).getTime() - Date.now());
  return <>{`${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`}</>;
}

export function CheckoutModal({ order, booking, onClose }: { order: OrderView; booking?: BookingView; onClose: () => void }) {
  const { boot, reloadMe } = useStore();
  const { data: pix } = useApi<PixInfo>(`/api/me/orders/${order.id}/pix`);
  const [pick, setPick] = useState(0);
  const [stage, setStage] = useState<'pay' | 'sent'>(booking?.pixClaimed ? 'sent' : 'pay');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const place = placeOf(boot, order.place);
  const opt = pix?.options[pick] ?? pix?.options[0];
  const instructor = firstName(boot.config.instructor);

  const copy = async () => {
    if (!opt) return;
    try {
      await navigator.clipboard.writeText(opt.payload);
    } catch {
      (document.getElementById('pix-code') as HTMLInputElement | null)?.select();
      document.execCommand('copy');
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const sent = async () => {
    if (!opt) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/me/orders/${order.id}/pix-sent`, { body: { cents: opt.cents } });
      setStage('sent');
      await reloadMe();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={stage === 'sent' ? 'Pix enviado' : 'Pagamento por Pix'} onClose={onClose} className="checkout">
      {stage === 'sent' ? (
        <div className="success">
          <div className="success-icon"><Icon name="check" /></div>
          <h3>Recebemos o seu aviso!</h3>
          <p>{instructor} vai conferir o Pix e confirmar a sua aula. Você recebe uma notificação assim que estiver confirmada.</p>
          {booking && <div className="hint">{fmtShort(booking.date)} às {booking.time} · {place?.name}</div>}
          <div className="modal-actions center"><Btn icon="arrow" onClick={onClose}>Ok, entendi</Btn></div>
        </div>
      ) : (
        <>
          <div className="checkout-summary">
            <div>
              <strong>{order.planLabel}{order.people > 1 ? ' · 2 pessoas' : ''}</strong>
              <small>{place?.name}{booking ? ` · ${fmtShort(booking.date)} às ${booking.time}` : ''} · pedido {order.code}</small>
            </div>
            <strong>{money(order.totalCents)}</strong>
          </div>
          {booking?.status === 'pending_payment' && booking.holdUntil && (
            <p className="legal-note hold"><Icon name="clock" /> Horário guardado por <Countdown until={booking.holdUntil} /> enquanto você faz o Pix.</p>
          )}
          {!pix ? (
            <div className="processing"><div className="spinner" /></div>
          ) : !pix.options.length ? (
            <div className="notice ok"><Icon name="check" /><p>Este pedido já está pago.</p></div>
          ) : (
            <>
              <div className="amount-options">
                {pix.options.map((o, i) => (
                  <label key={o.kind} className={`amount ${i === pick ? 'active' : ''}`}>
                    <input type="radio" name="pay-amount" checked={i === pick} onChange={() => setPick(i)} />
                    <span>
                      <strong>{o.kind === 'deposit' ? `Sinal de ${boot.config.depositPct}%` : o.kind === 'remaining' ? 'Restante' : 'Valor total'}</strong>
                      <small>{o.kind === 'deposit' ? 'Garante o seu horário' : o.kind === 'full' ? 'Nada a pagar no dia' : 'Quita o pedido'}</small>
                    </span>
                    <em>{money(o.cents)}</em>
                  </label>
                ))}
              </div>
              {opt && (
                <>
                  <div className="pix-area">
                    <QrSvg text={opt.payload} />
                    <div className="pix-info">
                      <span className="pulse-dot" />
                      <strong>Pague pelo app do seu banco</strong>
                      <small>Escaneie o QR Code ou use o copia e cola</small>
                      <Detail label="Valor">{money(opt.cents)}</Detail>
                      <Detail label="Recebedor">{pix.receiver}</Detail>
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="pix-code">Pix copia e cola</label>
                    <div className="copy-row">
                      <input id="pix-code" readOnly value={opt.payload} onFocus={(e) => e.currentTarget.select()} />
                      <Btn variant="secondary" icon="copy" onClick={copy}>{copied ? 'Copiado!' : 'Copiar'}</Btn>
                    </div>
                  </div>
                  {error && <div className="notice warn"><Icon name="info" /><p>{error}</p></div>}
                  <div className="modal-actions">
                    <Btn icon="check" busy={busy} onClick={sent}>Já fiz o Pix</Btn>
                  </div>
                  <p className="legal-note secure"><Icon name="lock" /> O Pix vai direto para a conta de {boot.config.instructor}. O app não guarda dados bancários.</p>
                </>
              )}
            </>
          )}
        </>
      )}
    </Modal>
  );
}
