// Telas do aluno: início, locais e valores, pranchas (se o quiver estiver ativo), instalar e privacidade.
import { useState } from 'react';

import { imageUrl, PLANS, type PlanId } from '../../shared/domain';
import { Icon } from '../components/icons';
import { InstallBanner, InstallGuide, PushCard } from '../components/install';
import { Btn, Detail, Empty, Modal, Multiline, PageTitle, Spinner } from '../components/ui';
import { firstName, fmt, money, today } from '../lib/format';
import { useApi } from '../lib/hooks';
import { navigate, useTitle } from '../lib/router';
import { type Board, byTime, isLive, type Place } from '../lib/types';
import { LessonCard } from './Lessons';
import { useStore } from './store';

export function BoardImg({ b, cls = '' }: { b: Board | null | undefined; cls?: string }) {
  if (!b?.imageId) return <div className={`board-empty ${cls}`}><Icon name="board" /></div>;
  return <img className={`board-img ${cls}`} src={imageUrl(b.imageId)!} alt={`${b.name} ${b.size}`} loading="lazy" />;
}

export function BoardCard({ b, eyebrow, onOpen }: { b: Board | null; eyebrow?: string; onOpen?: () => void }) {
  if (!b)
    return (
      <section className="card board-card">
        <div className="eyebrow">{eyebrow ?? 'SUA PRANCHA'}</div>
        <div className="board-title"><h3>A definir</h3><Icon name="board" /></div>
        <div className="board-stage"><BoardImg b={null} /></div>
        <p className="muted" style={{ fontSize: 12 }}>O instrutor escolhe a prancha ideal para a sua aula.</p>
      </section>
    );
  return (
    <section className="card board-card">
      <div className="eyebrow">{eyebrow ?? b.type.toUpperCase()}</div>
      <div className="board-title"><h3>{b.name}</h3><Icon name="board" /></div>
      <div className="board-stage"><BoardImg b={b} /></div>
      <div className="board-measures">
        <div><small>TAMANHO</small><strong>{b.size || '—'}</strong></div>
        <div><small>VOLUME</small><strong>{b.volume || '—'}</strong></div>
        <div><small>NÍVEL</small><strong style={{ fontSize: 11 }}>{b.level}</strong></div>
      </div>
      {onOpen && <button type="button" className="text-btn" onClick={onOpen}>Conhecer a prancha <Icon name="arrow" /></button>}
    </section>
  );
}

export function PlaceCard({ p, onClick }: { p: Place; onClick: () => void }) {
  const fallback = p.id === 'farol' ? '/img/coast.jpg' : '/img/beach.jpg';
  return (
    <button type="button" className="place" onClick={onClick}>
      <div className="place-img">
        <img src={imageUrl(p.imageId, fallback)!} alt={p.name} loading="lazy" />
        <span className="badge"><Icon name={p.capacity > 1 ? 'users' : 'user'} /> {p.modality.toUpperCase()}</span>
      </div>
      <div className="place-body">
        <div>
          <h3>{p.name}</h3>
          <p>{p.schedule === 'tide' ? 'Horários conforme a maré' : `Das ${p.hours[0]?.slice(0, 2) ?? '6'}h às ${String(Number(p.hours.at(-1)?.slice(0, 2) ?? 11) + 1)}h`} · a partir de {money(Math.round(p.prices.pack10 / 10))}/aula</p>
        </div>
        <Icon name="arrow" />
      </div>
    </button>
  );
}

export function PlaceModal({ p, onClose }: { p: Place; onClose: () => void }) {
  return (
    <Modal title={p.name} onClose={onClose}>
      <div className="place-img" style={{ borderRadius: 12, marginBottom: 14 }}>
        <img src={imageUrl(p.imageId, p.id === 'farol' ? '/img/coast.jpg' : '/img/beach.jpg')!} alt="" />
      </div>
      <p className="muted"><Multiline text={p.description} /></p>
      <div className="spacer">
        {(Object.keys(PLANS) as PlanId[]).map((k) => (
          <Detail key={k} label={PLANS[k].label}>{money(p.prices[k])}</Detail>
        ))}
      </div>
      <div className="hint"><Icon name="pin" /> {p.meeting}</div>
      <div className="modal-actions wrap">
        <a className="btn secondary" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}`} target="_blank" rel="noopener noreferrer">Abrir mapa <Icon name="pin" /></a>
        <Btn icon="arrow" onClick={() => (onClose(), navigate(`/agendar?local=${p.id}`))}>Agendar aqui</Btn>
      </div>
    </Modal>
  );
}

export function Policies() {
  const { boot } = useStore();
  const c = boot.config;
  return (
    <div className="hint policies">
      <strong>Como funciona</strong>
      <br />
      {c.texts.howItWorks.split('\n').filter(Boolean).map((l, i) => <span key={i}>• {l}<br /></span>)}
      • Sinal de {c.depositPct}% pelo Pix para garantir o horário.
      <br />• Cancelamento pelo app até {c.cancelLimitHours} h antes: o valor é devolvido (avulsa) ou volta como crédito (pacote).
      {c.rescheduleLimit > 0 && <><br />• Dá para remarcar {c.rescheduleLimit === 1 ? 'uma vez' : `${c.rescheduleLimit} vezes`}, até {c.rescheduleLimitHours} h antes.</>}
    </div>
  );
}

export function Home() {
  useTitle('');
  const { boot, me, requireLogin } = useStore();
  const [openPlace, setOpenPlace] = useState<Place | null>(null);
  const c = boot.config;
  const mine = me?.bookings ?? [];
  const next = mine.filter((b) => isLive(b) && new Date(b.startsAt).getTime() > Date.now()).sort(byTime)[0];
  const done = mine.filter((b) => b.status === 'done').length;
  const packs = (me?.orders ?? []).filter((o) => o.plan !== 'single' && ['active', 'paid'].includes(o.status) && (!o.expiresOn || o.expiresOn >= today()) && o.used < o.lessons);
  const tip = me?.tips[0];
  const board = c.quiverEnabled ? (boot.boards.find((b) => b.id === next?.boardId) ?? me?.profile.board ?? null) : null;
  return (
    <>
      <div className="greeting">
        <div>
          <h1>{c.texts.homeGreeting}{me ? `, ${firstName(me.profile.name)}` : ''}? <span style={{ color: 'var(--orange)' }}>☀</span></h1>
          <p>{c.texts.homeIntro}</p>
        </div>
        <div className="date-label"><Icon name="calendar" />{fmt(today(), { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>
      <InstallBanner />
      <div className="home-grid">
        <div>
          <section className="hero">
            <img src={imageUrl(c.images.hero, '/img/surf.jpg')!} alt="Surfista em uma onda" fetchPriority="high" />
            <div className="hero-copy">
              <div className="eyebrow"><span className="dot" /> {c.texts.heroEyebrow}</div>
              <h2>{c.texts.heroTitle}</h2>
              <p>{c.texts.heroSubtitle}</p>
              <Btn icon="arrow" onClick={() => navigate('/agendar')}>Agendar minha aula</Btn>
            </div>
          </section>
          {me && <PushCard who="student" hours={c.reminders.hours} />}
          <div className="section-head">
            <h2>Sua próxima sessão</h2>
            <button type="button" className="text-btn" onClick={() => requireLogin(() => navigate('/aulas'))}>Ver minhas aulas <Icon name="arrow" /></button>
          </div>
          {next ? (
            <LessonCard b={next} />
          ) : (
            <Empty icon="wave" title="Seu próximo mergulho na rotina." text="Escolha uma praia, um horário e encontre a gente no mar." action={<Btn icon="arrow" onClick={() => navigate('/agendar')}>Encontrar uma aula</Btn>} />
          )}
          {tip && (
            <>
              <div className="section-head"><h2>Dica do instrutor</h2></div>
              <div className="card tip"><Icon name="leaf" /><div><p>“{tip.text}”</p><small>{c.instructor} · {fmt(tip.at.slice(0, 10))}</small></div></div>
            </>
          )}
          <div className="section-head">
            <h2>Onde a gente surfa</h2>
            <button type="button" className="text-btn" onClick={() => navigate('/locais')}>Valores e locais <Icon name="arrow" /></button>
          </div>
          <div className="places-grid">{boot.places.map((p) => <PlaceCard key={p.id} p={p} onClick={() => setOpenPlace(p)} />)}</div>
        </div>
        <aside className="home-aside">
          {c.quiverEnabled && <BoardCard b={board} eyebrow="SUA PRANCHA NA PRÓXIMA AULA" />}
          <section className="card progress-card">
            <div className="progress-top"><span><Icon name="leaf" /></span><div><h3>Cada onda conta.</h3><p>{packs.length ? 'Seus créditos de pacote' : 'Seu caminho no surf'}</p></div></div>
            {packs.length ? (
              packs.map((o) => (
                <div key={o.id}>
                  <div className="progress-line"><i style={{ width: `${(o.used / o.lessons) * 100}%` }} /></div>
                  <div className="progress-caption"><span><strong>{o.lessons - o.used}</strong> restantes de {o.lessons} · {boot.places.find((p) => p.id === o.place)?.short}</span>{o.expiresOn && <span>até {fmt(o.expiresOn, { day: '2-digit', month: '2-digit' })}</span>}</div>
                </div>
              ))
            ) : (
              <>
                <div className="progress-line"><i style={{ width: `${Math.min(100, done * 10)}%` }} /></div>
                <div className="progress-caption"><span><strong>{done}</strong> aulas realizadas</span><span>{me?.profile.level ?? ''}</span></div>
              </>
            )}
          </section>
          <div className="quote">“{c.texts.quote}”<small>{c.texts.quoteSignature}</small></div>
        </aside>
      </div>
      {openPlace && <PlaceModal p={openPlace} onClose={() => setOpenPlace(null)} />}
    </>
  );
}

export function Places() {
  useTitle('Locais e valores');
  const { boot } = useStore();
  const [openPlace, setOpenPlace] = useState<Place | null>(null);
  return (
    <div className="page-content">
      <PageTitle title="Encontre a sua praia." sub="Dois picos em Salvador, dois formatos de aula." />
      <div className="places-grid">{boot.places.map((p) => <PlaceCard key={p.id} p={p} onClick={() => setOpenPlace(p)} />)}</div>
      <div className="price-grid spacer">
        {boot.places.map((p) => (
          <section key={p.id} className="card">
            <div className="row between"><h3>{p.name}</h3><span className="badge orange">{p.modality.toUpperCase()}</span></div>
            <p className="muted" style={{ fontSize: 12, margin: '6px 0 10px' }}>{p.description}</p>
            {(Object.keys(PLANS) as PlanId[]).map((k) => (
              <Detail key={k} label={<>{PLANS[k].label}{k !== 'single' && <small className="muted"> · válido {boot.config.packDays[k]} dias</small>}</>}>{money(p.prices[k])}</Detail>
            ))}
          </section>
        ))}
      </div>
      <Policies />
      {openPlace && <PlaceModal p={openPlace} onClose={() => setOpenPlace(null)} />}
    </div>
  );
}

export function Boards() {
  useTitle('Pranchas');
  const { boot } = useStore();
  const [open, setOpen] = useState<Board | null>(null);
  return (
    <div className="page-content">
      <PageTitle title="O quiver da escola." sub="A prancha é fornecida pela escola. O instrutor escolhe a ideal para o seu nível e para o mar do dia." />
      <div className="board-gallery">
        {boot.boards.length ? boot.boards.map((b) => <BoardCard key={b.id} b={b} onOpen={() => setOpen(b)} />) : <Empty icon="board" title="Quiver em manutenção." text="Em breve as pranchas aparecem aqui." />}
      </div>
      {open && (
        <Modal title={open.name} onClose={() => setOpen(null)}>
          <div className="board-stage big"><BoardImg b={open} /></div>
          <Detail label="Tipo">{open.type}</Detail>
          <Detail label="Tamanho">{open.size || '—'}</Detail>
          <Detail label="Volume">{open.volume || '—'}</Detail>
          <Detail label="Nível">{open.level}</Detail>
          {open.description && <p className="spacer muted">{open.description}</p>}
        </Modal>
      )}
    </div>
  );
}

export function InstallPage() {
  useTitle('Instalar o app');
  return (
    <div className="page-content narrow">
      <PageTitle title="Na tela inicial do seu celular." sub="Sem loja de aplicativos e sem ocupar espaço. Abre em 1 toque e avisa você das aulas." />
      <section className="card">
        <InstallGuide />
      </section>
    </div>
  );
}

export function Privacy() {
  useTitle('Privacidade');
  const { data } = useApi<{ privacyPolicy: string; terms: string; updatedAt: string }>('/api/public/legal');
  if (!data) return <Spinner />;
  return (
    <div className="page-content narrow legal">
      <PageTitle title="Privacidade e termos." sub="O que guardamos, para quê e os seus direitos." />
      <section className="card legal-text"><Multiline text={data.privacyPolicy} /></section>
      <section className="card legal-text spacer"><Multiline text={data.terms} /></section>
    </div>
  );
}
