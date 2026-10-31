// Perfil: dados mínimos, pacotes e pagamentos, orientações, notificações, senha, cópia dos dados e apagar conta.
import { useState } from 'react';

import { formatPhoneBR } from '../../shared/phone';
import { Avatar, AVATAR_OPTIONS } from '../components/Avatar';
import { Icon } from '../components/icons';
import { PushCard } from '../components/install';
import { Btn, Detail, Modal, PageTitle, useToast } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { fmt, money } from '../lib/format';
import { Link, navigate, useTitle } from '../lib/router';
import { BoardCard } from './Pages';
import { CheckoutModal } from './Checkout';
import { useStore } from './store';

export function Profile() {
  useTitle('Perfil');
  const { boot, me, reloadMe, logout } = useStore();
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [pwd, setPwd] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const [del, setDel] = useState(false);
  const [payOrder, setPayOrder] = useState<string | null>(null);
  const [name, setName] = useState(me?.profile.name ?? '');
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!me) return null;
  const done = me.bookings.filter((b) => b.status === 'done').length;
  const orders = me.orders.filter((o) => o.status !== 'expired');
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      toast(ok);
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const order = orders.find((o) => o.id === payOrder);
  return (
    <div className="page-content">
      <PageTitle title="Seu surf. Sua história." sub="Seus dados, pacotes e orientações do instrutor." action={<Btn variant="secondary" icon="logout" onClick={async () => (await logout(), navigate('/'))}>Sair</Btn>} />
      <div className="profile-layout">
        <div>
          <section className="card">
            <div className="profile-head">
              <button type="button" className="avatar-edit" aria-label="Trocar o ícone do perfil" onClick={() => (setError(null), setPick(me.profile.avatar))}>
                <Avatar id={me.profile.avatar} size={68} className="big" />
                <span className="badge-edit" aria-hidden="true"><Icon name="edit" /></span>
              </button>
              <div><h2>{me.profile.name}</h2><p>{formatPhoneBR(me.profile.phone)}</p><span className="badge orange">{me.profile.level}</span></div>
            </div>
            <Detail label="Aulas realizadas">{done}</Detail>
            <Detail label="Aluno desde">{fmt(me.profile.since.slice(0, 10), { month: 'long', year: 'numeric' })}</Detail>
            <div className="row wrap spacer">
              <Btn variant="secondary" icon="edit" onClick={() => (setName(me.profile.name), setEdit(true))}>Editar nome</Btn>
              <Btn variant="secondary" icon="lock" onClick={() => setPwd(true)}>Trocar senha</Btn>
            </div>
            <p className="legal-note spacer">Para trocar o celular, fale com o instrutor.</p>
          </section>
          <div className="spacer"><PushCard who="student" hours={boot.config.reminders.hours} /></div>
          <section className="card spacer">
            <h3>Pacotes e pagamentos</h3>
            {orders.length ? (
              orders.map((o) => {
                const due = o.totalCents - o.paidCents;
                return (
                  <div key={o.id} className="order-row">
                    <div>
                      <strong>{o.planLabel} · {boot.places.find((p) => p.id === o.place)?.short}</strong>
                      <small>{o.plan !== 'single' ? `${o.lessons - o.used} de ${o.lessons} aulas restantes${o.expiresOn ? ` · válido até ${fmt(o.expiresOn)}` : ''}` : 'Aula avulsa'} · pedido {o.code}</small>
                    </div>
                    <div className="right">
                      <strong>{money(o.paidCents)}<small> de {money(o.totalCents)}</small></strong>
                      {o.refundDueCents > 0 ? <span className="badge orange">A DEVOLVER {money(o.refundDueCents)}</span> : o.refundedCents > 0 ? <span className="badge gray">DEVOLVIDO</span> : o.status === 'cancelled' ? <span className="badge gray">CANCELADO</span> : due > 0 && o.paidCents > 0 ? <button type="button" className="text-btn" onClick={() => setPayOrder(o.id)}>Pagar restante <Icon name="arrow" /></button> : due > 0 ? <span className="badge gray">AGUARDANDO SINAL</span> : <span className="badge">QUITADO</span>}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="muted spacer">Nenhum pagamento ainda.</p>
            )}
          </section>
          <section className="card spacer">
            <h3>Orientações do instrutor</h3>
            {me.tips.length ? me.tips.map((n) => <div key={n.id} className="note"><small>{boot.config.instructor} · {fmt(n.at.slice(0, 10))}</small><p>{n.text}</p></div>) : <p className="muted spacer">As próximas orientações vão aparecer aqui.</p>}
          </section>
          <section className="card spacer">
            <h3>Seus dados</h3>
            <p className="muted">Guardamos só nome, celular, senha protegida e o histórico das aulas. <Link to="/privacidade" className="link">Ver a política de privacidade</Link>.</p>
            <div className="row wrap spacer">
              <a className="btn secondary" href="/api/me/export" download>Baixar meus dados <Icon name="download" /></a>
              <Btn variant="danger" icon="trash" onClick={() => setDel(true)}>Apagar minha conta</Btn>
            </div>
          </section>
        </div>
        {boot.config.quiverEnabled && <BoardCard b={me.profile.board} eyebrow="SUA PRANCHA HABITUAL" />}
      </div>

      {edit && (
        <Modal title="Seu nome" onClose={() => setEdit(false)}>
          <div className="field"><label htmlFor="p-name">Nome completo</label><input id="p-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></div>
          {error && <p className="error-text">{error}</p>}
          <div className="modal-actions"><Btn busy={busy} icon="check" onClick={async () => (await run(() => api('/api/me/profile', { body: { name } }).then(reloadMe), 'Nome atualizado.')) && setEdit(false)}>Salvar</Btn></div>
        </Modal>
      )}
      {pick && (
        <Modal title="Seu ícone" onClose={() => setPick(null)}>
          <div className="avatar-pick" role="group" aria-label="Escolha um ícone">
            {AVATAR_OPTIONS.map((o) => (
              <button key={o.id} type="button" aria-pressed={pick === o.id} onClick={() => setPick(o.id)}>
                <Avatar id={o.id} size={52} />
                {o.label}
              </button>
            ))}
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="modal-actions"><Btn busy={busy} icon="check" disabled={pick === me.profile.avatar} onClick={async () => (await run(() => api('/api/me/avatar', { body: { avatar: pick } }).then(reloadMe), 'Ícone atualizado.')) && setPick(null)}>Salvar</Btn></div>
        </Modal>
      )}
      {pwd && (
        <Modal title="Trocar senha" onClose={() => setPwd(false)}>
          <div className="field"><label htmlFor="p-cur">Senha atual</label><input id="p-cur" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
          <div className="field"><label htmlFor="p-new">Nova senha (mín. 6 caracteres)</label><input id="p-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></div>
          {error && <p className="error-text">{error}</p>}
          <div className="modal-actions"><Btn busy={busy} icon="check" onClick={async () => (await run(() => api('/api/me/password', { body: { current: cur, next } }), 'Senha trocada.')) && setPwd(false)}>Salvar</Btn></div>
        </Modal>
      )}
      {del && (
        <Modal title="Apagar sua conta?" onClose={() => setDel(false)}>
          <p>Seu nome, celular e senha são apagados na hora e você sai do app. O histórico financeiro fica sem identificação, como exige a lei.</p>
          {error && <p className="error-text">{error}</p>}
          <div className="modal-actions">
            <Btn variant="secondary" onClick={() => setDel(false)}>Voltar</Btn>
            <Btn variant="danger" busy={busy} onClick={async () => { if (await run(() => api('/api/me/delete', { body: {} }), 'Conta apagada.')) { await logout(); navigate('/'); } }}>Apagar definitivamente</Btn>
          </div>
        </Modal>
      )}
      {order && <CheckoutModal order={order} onClose={() => setPayOrder(null)} />}
    </div>
  );
}
