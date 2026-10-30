// Ajustes do painel, separados por seção: escola, Pix e sinal, regras, lembretes, aparência, locais e segurança.
// As regras da escola são um único registro: as seções editam o mesmo rascunho e a barra "Salvar" aparece
// só quando algo mudou. Horários de aula ficam na tela Horários.
import { useEffect, useMemo, useState } from 'react';

import { PLANS, type PlanId } from '../../shared/domain';
import { formatPhoneBR } from '../../shared/phone';
import { Icon, type IconName } from '../components/icons';
import { PushCard } from '../components/install';
import { ThemePick } from '../components/ThemePick';
import { Btn, PageTitle, Skeleton, useToast } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { useApi } from '../lib/hooks';
import { navigate, useSearch, useTitle } from '../lib/router';
import { useTheme } from '../lib/theme';
import type { Place } from '../lib/types';

export interface SchoolSettings {
  school: string;
  instructor: string;
  whatsapp: string;
  pixKey: string;
  pixName: string;
  pixCity: string;
  depositPct: number;
  holdMinutes: number;
  autoConfirm: boolean;
  cancelLimitHours: number;
  rescheduleLimit: number;
  rescheduleLimitHours: number;
  minNoticeHours: number;
  horizonDays: number;
  pack5Days: number;
  pack10Days: number;
  remindStudentHours: number[];
  remindAdminHours: number[];
  remindMorningAt: string | null;
  quiverEnabled: boolean;
}
export type AdminPlace = Place & { waveFactor: number; active: boolean };
type S = SchoolSettings;

type Tab = 'escola' | 'pix' | 'regras' | 'lembretes' | 'aparencia' | 'locais' | 'seguranca';
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'escola', label: 'Escola', icon: 'home' },
  { id: 'pix', label: 'Pix e sinal', icon: 'pix' },
  { id: 'regras', label: 'Regras', icon: 'list' },
  { id: 'lembretes', label: 'Lembretes', icon: 'bell' },
  { id: 'aparencia', label: 'Aparência', icon: 'sun' },
  { id: 'locais', label: 'Locais e preços', icon: 'pin' },
  { id: 'seguranca', label: 'Segurança', icon: 'shield' },
];

const HOUR_OPTIONS = [48, 24, 12, 6, 3, 2, 1];
const hourLabel = (h: number) => (h % 24 === 0 ? `${h / 24} dia${h > 24 ? 's' : ''} antes` : `${h} h antes`);

/** Campo numérico com − e +: mais fácil no celular que o teclado. */
export function Stepper({ id, value, onChange, min, max, step = 1, unit }: { id: string; value: number; onChange: (n: number) => void; min: number; max: number; step?: number; unit?: string }) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div className="num-input">
      <button type="button" aria-label="Diminuir" onClick={() => onChange(clamp(value - step))} disabled={value <= min}>−</button>
      <input id={id} type="number" inputMode="numeric" min={min} max={max} value={value} onChange={(e) => onChange(clamp(Math.round(Number(e.target.value) || 0)))} />
      {unit && <em>{unit}</em>}
      <button type="button" aria-label="Aumentar" onClick={() => onChange(clamp(value + step))} disabled={value >= max}>+</button>
    </div>
  );
}

function Row({ id, title, help, children }: { id?: string; title: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="set-row">
      <div>
        {id ? <label htmlFor={id}><strong>{title}</strong></label> : <strong>{title}</strong>}
        {help && <small>{help}</small>}
      </div>
      <div className="ctrl">{children}</div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

function Hours({ label, value, onChange }: { label: string; value: number[]; onChange: (v: number[]) => void }) {
  return (
    <fieldset className="field" style={{ border: 0, padding: 0, margin: '10px 0 0' }}>
      <legend style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{label} <small className="muted">(até 4)</small></legend>
      <div className="chips">
        {HOUR_OPTIONS.map((h) => {
          const on = value.includes(h);
          return (
            <label key={h}>
              <input type="checkbox" checked={on} disabled={!on && value.length >= 4} onChange={(e) => onChange(e.target.checked ? [...value, h] : value.filter((x) => x !== h))} />
              {hourLabel(h)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function SchoolTab({ s, set }: { s: S; set: <K extends keyof S>(k: K, v: S[K]) => void }) {
  return (
    <div className="set-grid">
      <section className="card set-card">
        <h3>Dados da escola</h3>
        <p className="sub">Aparecem no app do aluno, nos avisos e no Pix.</p>
        <div className="field"><label htmlFor="s-school">Nome da escola</label><input id="s-school" maxLength={60} value={s.school} onChange={(e) => set('school', e.target.value)} /></div>
        <div className="field"><label htmlFor="s-ins">Instrutor</label><input id="s-ins" maxLength={60} autoComplete="name" value={s.instructor} onChange={(e) => set('instructor', e.target.value)} /></div>
        <div className="field"><label htmlFor="s-wa">WhatsApp de contato</label><input id="s-wa" type="tel" inputMode="tel" value={s.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} /><small className="help">Celular com DDD. Os alunos falam com você por aqui.</small></div>
      </section>
      <section className="card set-card">
        <h3>Recursos do app</h3>
        <p className="sub">O que o aluno vê.</p>
        <Row title="Quiver (pranchas)" help="Desligado, o aluno não vê nada sobre pranchas.">
          <Toggle label="Quiver no app do aluno" checked={s.quiverEnabled} onChange={(v) => set('quiverEnabled', v)} />
        </Row>
      </section>
    </div>
  );
}

function PixTab({ s, set }: { s: S; set: <K extends keyof S>(k: K, v: S[K]) => void }) {
  return (
    <div className="set-grid">
      <section className="card set-card">
        <h3>Chave Pix</h3>
        <p className="sub">O QR Code e o copia e cola são gerados com estes dados e o valor exato do sinal.</p>
        <div className="field"><label htmlFor="s-pix">Chave Pix</label><input id="s-pix" maxLength={77} autoCapitalize="off" autoCorrect="off" spellCheck={false} value={s.pixKey} onChange={(e) => set('pixKey', e.target.value)} /><small className="help">Celular, e-mail, CPF/CNPJ ou chave aleatória.</small></div>
        <div className="field"><label htmlFor="s-pixn">Nome do recebedor (como no banco)</label><input id="s-pixn" maxLength={25} value={s.pixName} onChange={(e) => set('pixName', e.target.value)} /></div>
        <div className="field"><label htmlFor="s-pixc">Cidade</label><input id="s-pixc" maxLength={15} value={s.pixCity} onChange={(e) => set('pixCity', e.target.value)} /></div>
      </section>
      <section className="card set-card">
        <h3>Sinal</h3>
        <p className="sub">Quanto o aluno paga para garantir a vaga e quanto tempo o horário fica guardado.</p>
        <Row id="s-dep" title="Sinal" help="Porcentagem do valor da aula ou do pacote.">
          <Stepper id="s-dep" value={s.depositPct} min={10} max={100} step={5} unit="%" onChange={(n) => set('depositPct', n)} />
        </Row>
        <Row id="s-hold" title="Tempo para pagar" help="Sem aviso de Pix nesse prazo, o horário volta a ficar livre.">
          <Stepper id="s-hold" value={s.holdMinutes} min={5} max={240} step={5} unit="min" onChange={(n) => set('holdMinutes', n)} />
        </Row>
      </section>
    </div>
  );
}

function RulesTab({ s, set }: { s: S; set: <K extends keyof S>(k: K, v: S[K]) => void }) {
  return (
    <div className="set-grid">
      <section className="card set-card">
        <h3>Agendamento</h3>
        <p className="sub">Quando o aluno pode marcar aulas.</p>
        <Row id="s-min" title="Antecedência mínima" help="Para marcar uma aula pelo app.">
          <Stepper id="s-min" value={s.minNoticeHours} min={0} max={72} unit="h" onChange={(n) => set('minNoticeHours', n)} />
        </Row>
        <Row id="s-hz" title="Agenda aberta" help="Quantos dias à frente o aluno enxerga.">
          <Stepper id="s-hz" value={s.horizonDays} min={7} max={180} step={7} unit="dias" onChange={(n) => set('horizonDays', n)} />
        </Row>
        <Row title="Confirmar sozinho as aulas de pacote" help="Aluno com crédito agenda e já fica confirmado. Desligado, você confirma cada uma.">
          <Toggle label="Confirmar sozinho as aulas de pacote" checked={s.autoConfirm} onChange={(v) => set('autoConfirm', v)} />
        </Row>
      </section>
      <section className="card set-card">
        <h3>Cancelamento e remarcação</h3>
        <p className="sub">Dentro do prazo, aula avulsa fica com o valor “a devolver” e pacote recebe o crédito de volta.</p>
        <Row id="s-cancel" title="Cancelar pelo app até" help="Horas antes da aula.">
          <Stepper id="s-cancel" value={s.cancelLimitHours} min={0} max={720} unit="h" onChange={(n) => set('cancelLimitHours', n)} />
        </Row>
        <Row id="s-rlh" title="Remarcar pelo app até" help="Horas antes da aula.">
          <Stepper id="s-rlh" value={s.rescheduleLimitHours} min={0} max={720} unit="h" onChange={(n) => set('rescheduleLimitHours', n)} />
        </Row>
        <Row id="s-rl" title="Remarcações por aula" help="Quantas vezes o próprio aluno pode remarcar.">
          <Stepper id="s-rl" value={s.rescheduleLimit} min={0} max={5} unit="x" onChange={(n) => set('rescheduleLimit', n)} />
        </Row>
      </section>
      <section className="card set-card">
        <h3>Validade dos pacotes</h3>
        <p className="sub">Contada a partir da compra.</p>
        <Row id="s-p5" title="Pacote de 5 aulas">
          <Stepper id="s-p5" value={s.pack5Days} min={7} max={365} step={5} unit="dias" onChange={(n) => set('pack5Days', n)} />
        </Row>
        <Row id="s-p10" title="Pacote de 10 aulas">
          <Stepper id="s-p10" value={s.pack10Days} min={7} max={365} step={5} unit="dias" onChange={(n) => set('pack10Days', n)} />
        </Row>
      </section>
    </div>
  );
}

function RemindersTab({ s, set }: { s: S; set: <K extends keyof S>(k: K, v: S[K]) => void }) {
  return (
    <div className="set-grid">
      <section className="card set-card">
        <h3>Lembretes das aulas</h3>
        <p className="sub">Nada é enviado de madrugada: um lembrete que cairia entre 22h e 6h sai às 21h30 da véspera.</p>
        <Hours label="Para o aluno" value={s.remindStudentHours} onChange={(v) => set('remindStudentHours', v)} />
        <Hours label="Para você" value={s.remindAdminHours} onChange={(v) => set('remindAdminHours', v)} />
      </section>
      <section className="card set-card">
        <h3>Aviso da manhã</h3>
        <p className="sub">“Hoje tem aula” para o aluno (aulas a partir de 1 h depois do aviso) e um resumo do dia para você.</p>
        <Row title="Enviar aviso da manhã">
          <Toggle label="Aviso da manhã" checked={s.remindMorningAt !== null} onChange={(v) => set('remindMorningAt', v ? '06:30' : null)} />
        </Row>
        {s.remindMorningAt !== null && (
          <Row id="s-morning" title="Horário do aviso">
            <input id="s-morning" type="time" className="time-input" value={s.remindMorningAt} onChange={(e) => set('remindMorningAt', e.target.value || '06:30')} />
          </Row>
        )}
      </section>
      <div className="full"><PushCard who="admin" /></div>
    </div>
  );
}

function AppearanceTab() {
  const { pref, setPref } = useTheme();
  return (
    <section className="card set-card" style={{ maxWidth: 560 }}>
      <h3>Tema do painel</h3>
      <p className="sub">Vale só para este aparelho. O painel começa no tema claro; o app dos alunos tem a escolha de cada aluno.</p>
      <ThemePick value={pref === 'system' ? null : pref} onChange={setPref} />
      <button type="button" className="text-btn" style={{ marginTop: 10 }} aria-pressed={pref === 'system'} onClick={() => setPref('system')}>
        <Icon name={pref === 'system' ? 'check' : 'smartphone'} /> Seguir o tema do celular
      </button>
    </section>
  );
}

function PlaceEditor({ p, onSaved }: { p: AdminPlace; onSaved: () => void }) {
  const toast = useToast();
  const [v, setV] = useState(p);
  const [busy, setBusy] = useState(false);
  const reais = (c: number) => (c / 100).toFixed(2).replace('.', ',');
  const [prices, setPrices] = useState({ single: reais(p.prices.single), pack5: reais(p.prices.pack5), pack10: reais(p.prices.pack10) });
  useEffect(() => setV(p), [p]);
  const cents = (s: string) => Math.round(Number(s.replace(/\./g, '').replace(',', '.')) * 100);
  const bad = (Object.values(prices) as string[]).some((x) => !Number.isFinite(cents(x)) || cents(x) < 100);
  const save = async () => {
    setBusy(true);
    try {
      await api(`/api/admin/places/${p.id}`, { method: 'PUT', body: placeBody(v, { prices: { single: cents(prices.single), pack5: cents(prices.pack5), pack10: cents(prices.pack10) } }) });
      toast(`${v.short} atualizado.`);
      onSaved();
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card set-card">
      <div className="row between wrap" style={{ gap: 10 }}>
        <h3>{p.name}</h3>
        <label className="switch"><input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} /><span />{v.active ? 'Recebendo agendamentos' : 'Pausado'}</label>
      </div>
      <div className="form-grid spacer-sm">
        <div className="field"><label htmlFor={`pn-${p.id}`}>Nome</label><input id={`pn-${p.id}`} maxLength={60} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
        <div className="field"><label htmlFor={`ps-${p.id}`}>Nome curto</label><input id={`ps-${p.id}`} maxLength={30} value={v.short} onChange={(e) => setV({ ...v, short: e.target.value })} /></div>
        {(Object.keys(PLANS) as PlanId[]).map((k) => (
          <div key={k} className="field"><label htmlFor={`pp-${p.id}-${k}`}>{PLANS[k].label} (R$)</label><input id={`pp-${p.id}-${k}`} inputMode="decimal" value={prices[k]} onChange={(e) => setPrices({ ...prices, [k]: e.target.value.replace(/[^\d.,]/g, '') })} /></div>
        ))}
        <div className="field"><label htmlFor={`pm-${p.id}`}>Formato</label><input id={`pm-${p.id}`} maxLength={40} value={v.modality} onChange={(e) => setV({ ...v, modality: e.target.value })} placeholder="Individual" /></div>
        <div className="field full"><label htmlFor={`pd-${p.id}`}>Descrição</label><textarea id={`pd-${p.id}`} maxLength={600} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></div>
        <div className="field full"><label htmlFor={`pmt-${p.id}`}>Ponto de encontro</label><input id={`pmt-${p.id}`} maxLength={400} value={v.meeting} onChange={(e) => setV({ ...v, meeting: e.target.value })} /></div>
        <div className="field full"><label htmlFor={`pa-${p.id}`}>Endereço (mapa)</label><input id={`pa-${p.id}`} maxLength={160} value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></div>
        <div className="field full">
          <label htmlFor={`pw-${p.id}`}>Calibração da onda: {Math.round(v.waveFactor * 100)}%</label>
          <input id={`pw-${p.id}`} type="range" min={10} max={150} value={Math.round(v.waveFactor * 100)} onChange={(e) => setV({ ...v, waveFactor: Number(e.target.value) / 100 })} />
          <small className="help">Se a previsão mostrar onda maior do que você vê no pico, baixe; se menor, suba. Vale na hora para todos.</small>
        </div>
      </div>
      {bad && <p className="error-text">Cada preço precisa ser de pelo menos R$ 1,00.</p>}
      <div className="row between wrap spacer-sm" style={{ gap: 10 }}>
        <button type="button" className="text-btn" onClick={() => navigate('/painel/horarios')}><Icon name="clock" /> Dias, horários e vagas</button>
        <Btn icon="check" busy={busy} disabled={bad} onClick={save}>Salvar {v.short}</Btn>
      </div>
    </section>
  );
}

/** Corpo completo do PUT /places/:id a partir do local atual (a API exige todos os campos). */
export function placeBody(p: AdminPlace, patch: Partial<{ prices: AdminPlace['prices']; weekdays: number[]; hours: string[]; schedule: AdminPlace['schedule']; capacity: number }> = {}) {
  return {
    name: p.name,
    short: p.short,
    address: p.address,
    meeting: p.meeting,
    description: p.description,
    modality: p.modality,
    capacity: patch.capacity ?? p.capacity,
    weekdays: patch.weekdays ?? p.weekdays,
    hours: patch.hours ?? p.hours,
    schedule: patch.schedule ?? p.schedule,
    prices: patch.prices ?? p.prices,
    imageId: p.imageId ?? null,
    waveFactor: p.waveFactor,
    active: p.active,
  };
}

function SecurityTab() {
  const toast = useToast();
  const [pwd, setPwd] = useState({ current: '', next: '' });
  const [busy, setBusy] = useState(false);
  return (
    <section className="card set-card" style={{ maxWidth: 560 }}>
      <h3>Senha do painel</h3>
      <p className="sub">Ao trocar, os outros aparelhos são desconectados. A verificação em duas etapas continua ativa.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api('/api/admin/security/password', { body: pwd });
            toast('Senha trocada. Outros aparelhos foram desconectados.');
            setPwd({ current: '', next: '' });
          } catch (err) {
            toast(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <input type="text" name="username" autoComplete="username" hidden readOnly />
        <div className="field"><label htmlFor="pw-c">Senha atual</label><input id="pw-c" type="password" autoComplete="current-password" required value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} /></div>
        <div className="field"><label htmlFor="pw-n">Nova senha</label><input id="pw-n" type="password" autoComplete="new-password" required minLength={12} value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} /><small className="help">Mínimo de 12 caracteres, com letras e números.</small></div>
        <div className="modal-actions"><Btn type="submit" variant="secondary" busy={busy} disabled={!pwd.current || pwd.next.length < 12}>Trocar senha</Btn></div>
      </form>
    </section>
  );
}

const SCHOOL_TABS: Tab[] = ['escola', 'pix', 'regras', 'lembretes'];

export function SettingsPage() {
  useTitle('Ajustes');
  const toast = useToast();
  const search = useSearch();
  const q = search.get('aba') as Tab | null;
  const tab: Tab = TABS.some((t) => t.id === q) ? q! : 'escola';
  const { data, reload } = useApi<{ settings: S }>('/api/admin/settings');
  const { data: places, reload: reloadPlaces } = useApi<{ places: AdminPlace[] }>('/api/admin/places');
  const original = useMemo(() => (data ? { ...data.settings, whatsapp: formatPhoneBR(data.settings.whatsapp) } : null), [data]);
  const [s, setS] = useState<S | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setS(original), [original]);
  const dirty = !!s && !!original && JSON.stringify(s) !== JSON.stringify(original);
  // Aviso ao sair da página com alterações não salvas.
  useEffect(() => {
    if (!dirty) return;
    const on = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener('beforeunload', on);
    return () => removeEventListener('beforeunload', on);
  }, [dirty]);

  const set = <K extends keyof S>(k: K, v: S[K]) => setS((cur) => (cur ? { ...cur, [k]: v } : cur));
  const save = async () => {
    if (!s) return;
    setBusy(true);
    try {
      await api('/api/admin/settings', { method: 'PUT', body: s });
      toast('Ajustes salvos.');
      reload();
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const go = (t: Tab) => navigate(`/painel/ajustes?aba=${t}`, { replace: true, scroll: false });

  let body;
  if (SCHOOL_TABS.includes(tab) && !s) body = <Skeleton rows={3} />;
  else if (tab === 'escola') body = <SchoolTab s={s!} set={set} />;
  else if (tab === 'pix') body = <PixTab s={s!} set={set} />;
  else if (tab === 'regras') body = <RulesTab s={s!} set={set} />;
  else if (tab === 'lembretes') body = <RemindersTab s={s!} set={set} />;
  else if (tab === 'aparencia') body = <AppearanceTab />;
  else if (tab === 'locais') body = places ? <div className="set-grid">{places.places.map((p) => <PlaceEditor key={p.id} p={p} onSaved={reloadPlaces} />)}</div> : <Skeleton rows={2} />;
  else body = <SecurityTab />;

  return (
    <div className="page-content">
      <PageTitle title="Ajustes." sub="Regras da escola, Pix, lembretes, aparência e locais." />
      <div className="tabs-scroll" role="tablist" aria-label="Seções dos ajustes">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => go(t.id)}>
            <Icon name={t.icon} />
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{body}</div>
      {dirty && (
        <div className="save-bar" role="region" aria-label="Alterações não salvas">
          <span>Alterações não salvas</span>
          <div className="row">
            <Btn small variant="secondary" onClick={() => setS(original)}>Desfazer</Btn>
            <Btn small icon="check" busy={busy} onClick={save}>Salvar</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
