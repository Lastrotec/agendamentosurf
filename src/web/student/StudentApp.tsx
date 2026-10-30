// App do aluno: navegação, tema, avisos (sino), cadastro e etapa obrigatória das notificações.
import { useEffect, useState } from 'react';

import { ForecastPage } from '../components/forecast';
import { Icon, type IconName } from '../components/icons';
import { PushGate } from '../components/install';
import { Logo } from '../components/Logo';
import { Btn, Empty, Modal, Spinner } from '../components/ui';
import { api, cachedGet } from '../lib/api';
import { ago, initials } from '../lib/format';
import { navigate, usePath, useSearch } from '../lib/router';
import { useTheme } from '../lib/theme';
import { isStandalone } from '../pwa/pwa';
import type { Bootstrap } from '../lib/types';
import { AuthModal } from './Auth';
import { Book } from './Book';
import { LessonModal, LessonsPage } from './Lessons';
import { Boards, Home, InstallPage, Places, Privacy } from './Pages';
import { Profile } from './Profile';
import { StoreProvider, useStore } from './store';

function NoticesModal({ onClose }: { onClose: () => void }) {
  const { me, reloadMe } = useStore();
  useEffect(() => {
    if (me?.inbox.some((n) => !n.read)) void api('/api/me/inbox/read', { body: {} }).then(reloadMe, () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const list = me?.inbox ?? [];
  return (
    <Modal title="Notificações" onClose={onClose}>
      {list.length ? (
        <div className="feed">
          {list.map((n) => (
            <button key={n.id} type="button" className={`feed-item ${n.read ? '' : 'unread'}`} onClick={() => (onClose(), n.bookingId && navigate(`/aulas/${n.bookingId}`))}>
              <strong>{n.title}</strong>
              <small>{n.body}</small>
              <em>{ago(n.at)}</em>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty"><Icon name="bell" /><h3>Tudo em dia.</h3><p>Avisos sobre as suas aulas aparecem aqui.</p></div>
      )}
    </Modal>
  );
}

function LoginWall({ what }: { what: string }) {
  const { requireLogin } = useStore();
  return (
    <div className="page-content">
      <Empty icon="user" title={`Entre para ver ${what}.`} text="Cadastro rápido: nome, celular e uma senha." action={<Btn icon="arrow" onClick={() => requireLogin()}>Entrar ou criar conta</Btn>} />
    </div>
  );
}

function Shell() {
  const { boot, me, meLoading, requireLogin } = useStore();
  const path = usePath();
  const search = useSearch();
  const [notices, setNotices] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const { dark, toggle } = useTheme();
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    addEventListener('online', on);
    addEventListener('offline', on);
    return () => (removeEventListener('online', on), removeEventListener('offline', on));
  }, []);
  const c = boot.config;
  const nav: [string, IconName, string][] = [
    ['/', 'home', 'Início'],
    ['/agendar', 'calendar', 'Agendar'],
    ['/previsao', 'tide', 'Previsão'],
    ['/aulas', 'wave', 'Minhas aulas'],
    ...(c.quiverEnabled ? ([['/pranchas', 'board', 'Pranchas']] as [string, IconName, string][]) : []),
    ['/perfil', 'user', 'Perfil'],
  ];
  const lessonId = /^\/aulas\/([0-9a-f-]{36})$/.exec(path)?.[1];
  const active = lessonId ? '/aulas' : path;
  const unread = me?.inbox.filter((n) => !n.read).length ?? 0;
  const pendingPay = me?.bookings.filter((b) => b.status === 'pending_payment' && !b.pixClaimed && b.holdUntil && new Date(b.holdUntil) > new Date()).length ?? 0;

  let page;
  if (path === '/agendar') page = <Book />;
  else if (path === '/previsao') page = <ForecastPage places={boot.places} onBook={(p, d, t) => navigate(`/agendar?local=${p}${t ? `&data=${d}&hora=${t}` : ''}`)} />;
  else if (path === '/aulas' || lessonId) page = meLoading ? <Spinner /> : me ? <LessonsPage /> : <LoginWall what="suas aulas" />;
  else if (path === '/perfil') page = meLoading ? <Spinner /> : me ? <Profile /> : <LoginWall what="seu perfil" />;
  else if (path === '/pranchas' && c.quiverEnabled) page = <Boards />;
  else if (path === '/locais') page = <Places />;
  else if (path === '/instalar') page = <InstallPage />;
  else if (path === '/privacidade') page = <Privacy />;
  else page = <Home />;

  return (
    <div id="app">
      {!online && <div className="offline">Você está offline. Conecte-se para agendar ou pagar.</div>}
      <aside className="sidebar">
        <a href="/" className="brand" onClick={(e) => (e.preventDefault(), navigate('/'))} aria-label={c.school}>
          <Logo height={140} />
        </a>
        <div className="navlabel">Seu espaço</div>
        <nav className="nav" aria-label="Navegação principal">
          {nav.map(([to, ic, label]) => (
            <button key={to} type="button" className={active === to ? 'active' : ''} aria-current={active === to ? 'page' : undefined} onClick={() => (to === '/aulas' || to === '/perfil' ? requireLogin(() => navigate(to)) : navigate(to))}>
              <Icon name={ic} />
              <span>{label}</span>
              {to === '/aulas' && pendingPay > 0 && <i className="nav-badge">{pendingPay}</i>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="ocean-note"><Icon name="wave" /><h4>O mar está chamando.</h4><p>Desconecte da rotina.<br />Reconecte com você.</p></div>
          {!isStandalone() && <button type="button" className="small-link install-link" onClick={() => navigate('/instalar')}><Icon name="download" />Instalar o app</button>}
          <button type="button" className="small-link" onClick={() => navigate('/privacidade')}><Icon name="shield" />Privacidade</button>
          {me ? (
            <div className="user-mini"><div className="avatar">{initials(me.profile.name)}</div><div><strong>{me.profile.name}</strong><small>{me.profile.level}</small></div></div>
          ) : (
            <Btn full variant="secondary" icon="user" onClick={() => requireLogin()}>Entrar</Btn>
          )}
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">{c.school} <span>/</span><span>{nav.find((n) => n[0] === active)?.[2] ?? (path === '/locais' ? 'Locais' : path === '/instalar' ? 'Instalar' : path === '/privacidade' ? 'Privacidade' : 'Início')}</span></div>
          <a className="mobile-brand" href="/" onClick={(e) => (e.preventDefault(), navigate('/'))} aria-label={c.school}><Logo height={56} /></a>
          <div className="top-actions">
            {!isStandalone() && <button type="button" className="install-pill" onClick={() => navigate('/instalar')}><Icon name="download" />Instalar</button>}
            <button type="button" className="icon-btn" aria-label="Alternar tema" onClick={toggle}><Icon name={dark ? 'sun' : 'moon'} /></button>
            {me ? (
              <button type="button" className="icon-btn bell" aria-label={`Notificações${unread ? ` (${unread} novas)` : ''}`} onClick={() => setNotices(true)}>
                <Icon name="bell" />
                {unread > 0 && <i>{unread > 9 ? '9+' : unread}</i>}
              </button>
            ) : (
              <button type="button" className="btn small" onClick={() => requireLogin()}>Entrar</button>
            )}
          </div>
        </header>
        {page}
        <footer className="footer">
          <span><Icon name="wave" /> {c.school.toUpperCase()} · {c.instructor.toUpperCase()}</span>
          <span>{c.texts.footer} · <a className="link" href="/privacidade" onClick={(e) => (e.preventDefault(), navigate('/privacidade'))}>Privacidade</a></span>
        </footer>
      </main>
      {lessonId && me && <LessonModal id={lessonId} payNow={search.get('pagar') === '1'} onClose={() => navigate('/aulas', { scroll: false })} />}
      {notices && <NoticesModal onClose={() => setNotices(false)} />}
      <AuthModal />
      {me && <PushGate who="student" />}
    </div>
  );
}

export function StudentApp() {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    cachedGet<Bootstrap>('/api/public/bootstrap').then(setBoot, () => setFailed(true));
  }, []);
  if (failed)
    return (
      <div className="boot-error">
        <Logo height={150} />
        <h1>Não foi possível abrir o app.</h1>
        <p>Confira sua conexão e tente de novo.</p>
        <Btn icon="refresh" onClick={() => location.reload()}>Tentar de novo</Btn>
      </div>
    );
  if (!boot) return null;
  return (
    <StoreProvider boot={boot}>
      <Shell />
    </StoreProvider>
  );
}
