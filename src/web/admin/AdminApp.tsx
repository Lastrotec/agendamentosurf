// Painel do instrutor (/painel): app separado do aluno, com login próprio e verificação em duas etapas.
import qrcode from 'qrcode-generator';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Avatar } from '../components/Avatar';
import { Icon, type IconName } from '../components/icons';
import { Onboarding } from '../components/Onboarding';
import { Logo } from '../components/Logo';
import { Btn, Modal } from '../components/ui';
import { api, ApiError, cachedGet, clearApiMemo, errorMessage, preloadApi } from '../lib/api';
import { useApi } from '../lib/hooks';
import { ago, firstName, today } from '../lib/format';
import { navigate, signalAppReady, usePath, useTitle } from '../lib/router';
import { useTheme } from '../lib/theme';
import type { Bootstrap, Notice } from '../lib/types';
import { AgendaPage } from './Agenda';
import { BookingSheet, BookingsPage } from './Bookings';
import { ContentPage } from './Content';
import { Dashboard } from './Dashboard';
import { FinancePage } from './Finance';
import { HoursPage } from './Hours';
import { QuiverPage } from './Quiver';
import { SettingsPage } from './Settings';
import { StudentsPage } from './Students';
import { SystemPage } from './System';
import { ForecastPage } from '../components/forecast';

interface MeAdmin {
  name: string;
  email: string;
  totpEnabled: boolean;
  mfaRequired: boolean;
}

type Gate = 'loading' | 'login' | 'mfa' | 'setup' | 'ok';

function Login({ onDone, stage }: { onDone: () => void | Promise<void>; stage: 'login' | 'mfa' }) {
  const [step, setStep] = useState(stage);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useTitle('Painel');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (step === 'login') {
        const r = await api<{ mfaRequired: boolean }>('/api/admin/auth/login', { body: { email, password } });
        if (r.mfaRequired) return setStep('mfa');
      } else await api('/api/admin/auth/mfa', { body: { code } });
      // Mantém "Acessando…" enquanto o painel carrega todas as telas.
      await onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login-page">
      <form className="card" onSubmit={submit}>
        <Logo height={140} />
        <h2 style={{ textAlign: 'center' }}>Painel do instrutor</h2>
        <p className="muted" style={{ textAlign: 'center', marginBottom: 16 }}>{step === 'login' ? 'Entre com seu e-mail e senha.' : 'Digite o código de 6 dígitos do app autenticador.'}</p>
        {step === 'login' ? (
          <>
            <div className="field"><label htmlFor="l-email">E-mail</label><input id="l-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="field"><label htmlFor="l-pass">Senha</label><input id="l-pass" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          </>
        ) : (
          <div className="field"><label htmlFor="l-code">Código</label><input id="l-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></div>
        )}
        {error && <p className="error-text" role="alert">{error}</p>}
        <Btn type="submit" full busy={busy} icon="arrow">{busy ? 'Acessando…' : 'Entrar'}</Btn>
        <p className="legal-note spacer" style={{ textAlign: 'center' }}><a className="link" href="/">Ir para o app dos alunos</a></p>
      </form>
    </div>
  );
}

function MfaSetup({ onDone }: { onDone: () => void }) {
  const [data, setData] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ secret: string; uri: string }>('/api/admin/security/mfa/setup', { body: {} }).then(setData, (e) => setError(errorMessage(e)));
  }, []);
  const svg = useMemo(() => {
    if (!data) return '';
    const q = qrcode(0, 'M');
    q.addData(data.uri);
    q.make();
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }, [data]);
  return (
    <div className="login-page">
      <div className="card">
        <Logo height={130} />
        <h2 style={{ textAlign: 'center' }}>Proteja o painel</h2>
        <p className="muted" style={{ textAlign: 'center' }}>Obrigatório no primeiro acesso. Instale o Google Authenticator (ou similar), leia o QR Code e digite o código.</p>
        {svg && <div className="qr-box" style={{ margin: '16px auto', maxWidth: 200 }} dangerouslySetInnerHTML={{ __html: svg }} />}
        {data && <p className="legal-note" style={{ textAlign: 'center', wordBreak: 'break-all' }}>Ou digite a chave: <strong>{data.secret}</strong></p>}
        <div className="field"><label htmlFor="m-code">Código de 6 dígitos</label><input id="m-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></div>
        {error && <p className="error-text">{error}</p>}
        <Btn
          full
          busy={busy}
          icon="shield"
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await api('/api/admin/security/mfa/enable', { body: { code } });
              onDone();
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Ativar e entrar
        </Btn>
      </div>
    </div>
  );
}

const NAV: [string, IconName, string][] = [
  ['/painel', 'chart', 'Painel'],
  ['/painel/agenda', 'calendar', 'Agenda'],
  ['/painel/horarios', 'clock', 'Horários'],
  ['/painel/reservas', 'list', 'Reservas'],
  ['/painel/alunos', 'users', 'Alunos'],
  ['/painel/financeiro', 'money', 'Financeiro'],
  ['/painel/previsao', 'tide', 'Previsão'],
  ['/painel/quiver', 'board', 'Quiver'],
  ['/painel/conteudo', 'image', 'Textos e fotos'],
  ['/painel/ajustes', 'settings', 'Ajustes'],
  ['/painel/sistema', 'shield', 'Sistema'],
];
const MOBILE = ['/painel', '/painel/agenda', '/painel/reservas', '/painel/alunos'];

function AdminShell({ me, onLogout }: { me: MeAdmin; onLogout: () => void }) {
  const path = usePath();
  const { dark, toggle } = useTheme();
  const [more, setMore] = useState(false);
  const [bell, setBell] = useState(false);
  const { data: boot } = useApi<Bootstrap>('/api/public/bootstrap');
  const { data: inbox, reload: reloadInbox } = useApi<{ inbox: Notice[] }>('/api/admin/inbox');
  const { data: pending } = useApi<{ bookings: unknown[] }>('/api/admin/bookings?tab=pending');
  useEffect(() => {
    const on = () => document.visibilityState === 'visible' && reloadInbox();
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, [reloadInbox]);
  const bookingId = /^\/painel\/aula\/([0-9a-f-]{36})$/.exec(path)?.[1];
  const active = bookingId ? '/painel/reservas' : NAV.find(([to]) => to !== '/painel' && path.startsWith(to))?.[0] ?? '/painel';
  const unread = inbox?.inbox.filter((n) => !n.read).length ?? 0;
  const pend = pending?.bookings.length ?? 0;
  const go = (to: string) => (setMore(false), navigate(to));

  let page;
  if (path.startsWith('/painel/agenda')) page = <AgendaPage />;
  else if (path.startsWith('/painel/horarios')) page = <HoursPage />;
  else if (path.startsWith('/painel/reservas') || bookingId) page = <BookingsPage />;
  else if (path.startsWith('/painel/alunos')) page = <StudentsPage />;
  else if (path.startsWith('/painel/financeiro')) page = <FinancePage />;
  else if (path.startsWith('/painel/previsao')) page = boot ? <ForecastPage places={boot.places} /> : null;
  else if (path.startsWith('/painel/quiver')) page = <QuiverPage />;
  else if (path.startsWith('/painel/conteudo')) page = <ContentPage />;
  else if (path.startsWith('/painel/ajustes')) page = <SettingsPage />;
  else if (path.startsWith('/painel/sistema')) page = <SystemPage />;
  else page = <Dashboard name={firstName(me.name)} />;

  return (
    <div id="app" className="admin">
      <aside className="sidebar">
        <a href="/painel" className="brand" onClick={(e) => (e.preventDefault(), go('/painel'))}><Logo height={140} /></a>
        <div className="admin-badge">PAINEL DO INSTRUTOR</div>
        <nav className="nav" aria-label="Painel">
          {NAV.map(([to, ic, label]) => (
            <button key={to} type="button" className={`${active === to ? 'active' : ''} ${MOBILE.includes(to) ? '' : 'desk-only'}`} aria-current={active === to ? 'page' : undefined} onClick={() => go(to)}>
              <Icon name={ic} />
              <span>{label}</span>
              {to === '/painel/reservas' && pend > 0 && <i className="nav-badge">{pend}</i>}
            </button>
          ))}
          <button type="button" className={`mobile-only ${MOBILE.includes(active) ? '' : 'active'}`} onClick={() => setMore(true)}><Icon name="settings" /><span>Mais</span></button>
        </nav>
        <div className="sidebar-bottom">
          <button type="button" className="small-link" onClick={() => window.open('/', '_blank', 'noopener')}><Icon name="eye" />Ver app do aluno</button>
          <button type="button" className="small-link" onClick={onLogout}><Icon name="logout" />Sair</button>
          <div className="user-mini"><Avatar id="surfista" /><div><strong>{me.name}</strong><small>Instrutor · administrador</small></div></div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">Painel <span>/</span><span>{NAV.find((n) => n[0] === active)?.[2]}</span></div>
          <a className="mobile-brand" href="/painel" onClick={(e) => (e.preventDefault(), go('/painel'))}><Logo height={56} /></a>
          <div className="top-actions">
            <button type="button" className="icon-btn" aria-label="Alternar tema" onClick={toggle}><Icon name={dark ? 'sun' : 'moon'} /></button>
            <button type="button" className="icon-btn bell" aria-label={`Avisos${unread ? ` (${unread} novos)` : ''}`} onClick={() => setBell(true)}>
              <Icon name="bell" />
              {unread > 0 && <i>{unread > 9 ? '9+' : unread}</i>}
            </button>
          </div>
        </header>
        {page}
      </main>
      {bookingId && <BookingSheet id={bookingId} onClose={() => navigate('/painel/reservas', { scroll: false })} />}
      {more && (
        <Modal title="Mais opções" onClose={() => setMore(false)}>
          <div className="list-stack">
            {NAV.filter(([to]) => !MOBILE.includes(to)).map(([to, ic, label]) => (
              <button key={to} type="button" className="detail-row as-btn" onClick={() => go(to)}><span><Icon name={ic} /> {label}</span><Icon name="chevron" /></button>
            ))}
            <button type="button" className="detail-row as-btn" onClick={onLogout}><span><Icon name="logout" /> Sair</span></button>
          </div>
        </Modal>
      )}
      {bell && (
        <Modal title="Avisos" onClose={() => (setBell(false), unread && void api('/api/admin/inbox/read', { body: {} }).then(reloadInbox))}>
          {inbox?.inbox.length ? (
            <div className="feed">
              {inbox.inbox.map((n) => (
                <button key={n.id} type="button" className={`feed-item ${n.read ? '' : 'unread'}`} onClick={() => (setBell(false), n.bookingId && navigate(`/painel/aula/${n.bookingId}`))}>
                  <strong>{n.title}</strong>
                  <small>{n.body}</small>
                  <em>{ago(n.at)}</em>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty"><Icon name="bell" /><h3>Tudo em dia.</h3></div>
          )}
        </Modal>
      )}
      <Onboarding who="admin" loggedIn />
    </div>
  );
}

export default function AdminApp() {
  const [gate, setGate] = useState<Gate>('loading');
  const [me, setMe] = useState<MeAdmin | null>(null);
  const check = useCallback(async () => {
    try {
      const m = await api<MeAdmin>('/api/admin/auth/me');
      setMe(m);
      if (!m.totpEnabled && m.mfaRequired) return setGate('setup');
      // Tudo de uma vez: os dados de todas as telas do painel chegam enquanto a logo está no centro,
      // e cada tela abre na hora (atualizando em segundo plano). Imagens ficam de fora.
      const d = today();
      const places = await cachedGet<Bootstrap>('/api/public/bootstrap').then((b) => b.places.map((p) => p.id), () => [] as string[]);
      await preloadApi([
        '/api/admin/dashboard',
        '/api/admin/inbox',
        ...(['pending', 'upcoming', 'past', 'cancelled', 'refunds'] as const).map((t) => `/api/admin/bookings?tab=${t}`),
        `/api/admin/agenda?from=${d}&days=7`,
        '/api/admin/students',
        '/api/admin/boards',
        '/api/admin/settings',
        '/api/admin/places',
        '/api/admin/schedule',
        `/api/admin/finance?month=${d.slice(0, 7)}`,
        '/api/admin/system',
        ...places.map((p) => `/api/public/forecast/${p}`),
      ]);
      setGate('ok');
    } catch (e) {
      setGate(e instanceof ApiError && e.code === 'MFA_REQUIRED' ? 'mfa' : 'login');
    }
  }, []);
  useEffect(() => {
    void check();
  }, [check]);
  useEffect(() => {
    if (gate !== 'loading') requestAnimationFrame(signalAppReady);
  }, [gate]);
  if (gate === 'loading') return null;
  if (gate === 'login' || gate === 'mfa') return <Login stage={gate} onDone={() => (clearApiMemo(), check())} />;
  if (gate === 'setup') return <MfaSetup onDone={() => (clearApiMemo(), check())} />;
  return (
    <AdminShell
      me={me!}
      onLogout={async () => {
        await api('/api/admin/auth/logout', { body: {} }).catch(() => {});
        clearApiMemo();
        setGate('login');
      }}
    />
  );
}
