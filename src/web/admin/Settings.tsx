// Ajustes: Pix, regras de agendamento e cancelamento, lembretes, quiver, locais/preços/horários e senha.
import { useEffect, useState } from 'react';

import { PLANS, type PlanId } from '../../shared/domain';
import { formatPhoneBR } from '../../shared/phone';
import { Btn, PageTitle, Spinner, useToast } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { useApi } from '../lib/hooks';
import { DAY_NAMES } from '../lib/format';
import { useTitle } from '../lib/router';
import type { Place } from '../lib/types';

interface S {
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
type AdminPlace = Place & { waveFactor: number; active: boolean };

const HOUR_OPTIONS = [48, 24, 12, 6, 3, 2, 1];
const hourLabel = (h: number) => (h % 24 === 0 ? `${h / 24} dia${h > 24 ? 's' : ''} antes` : `${h} h antes`);

function Num({ id, label, value, onChange, min, max, help, suffix }: { id: string; label: string; value: number; onChange: (n: number) => void; min: number; max: number; help?: string; suffix?: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}{suffix ? ` (${suffix})` : ''}</label>
      <input id={id} type="number" inputMode="numeric" min={min} max={max} value={value} onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))} />
      {help && <small className="help">{help}</small>}
    </div>
  );
}

function Hours({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="chips">
      {HOUR_OPTIONS.map((h) => (
        <label key={h}><input type="checkbox" checked={value.includes(h)} onChange={(e) => onChange(e.target.checked ? [...value, h].slice(-4) : value.filter((x) => x !== h))} />{hourLabel(h)}</label>
      ))}
    </div>
  );
}

function PlaceEditor({ p, onSaved }: { p: AdminPlace; onSaved: () => void }) {
  const toast = useToast();
  const [v, setV] = useState(p);
  const [hours, setHours] = useState(p.hours.join(', '));
  const reais = (c: number) => (c / 100).toFixed(2).replace('.', ',');
  const [prices, setPrices] = useState({ single: reais(p.prices.single), pack5: reais(p.prices.pack5), pack10: reais(p.prices.pack10) });
  const save = async () => {
    try {
      const cents = (s: string) => Math.round(Number(s.replace(/\./g, '').replace(',', '.')) * 100);
      const { id: _id, facing: _f, ...rest } = v;
      void _id;
      void _f;
      await api(`/api/admin/places/${p.id}`, {
        method: 'PUT',
        body: { ...rest, hours: hours.split(/[,\s]+/).filter(Boolean).map((h) => (h.length <= 2 ? `${h.padStart(2, '0')}:00` : h.padStart(5, '0'))), prices: { single: cents(prices.single), pack5: cents(prices.pack5), pack10: cents(prices.pack10) } },
      });
      toast(`${v.short} atualizado.`);
      onSaved();
    } catch (e) {
      toast(errorMessage(e));
    }
  };
  return (
    <section className="card spacer">
      <h3>{p.name}</h3>
      <div className="form-grid spacer">
        <div className="field"><label htmlFor={`pn-${p.id}`}>Nome</label><input id={`pn-${p.id}`} maxLength={60} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
        <div className="field"><label htmlFor={`ps-${p.id}`}>Nome curto</label><input id={`ps-${p.id}`} maxLength={30} value={v.short} onChange={(e) => setV({ ...v, short: e.target.value })} /></div>
        {(Object.keys(PLANS) as PlanId[]).map((k) => (
          <div key={k} className="field"><label htmlFor={`pp-${p.id}-${k}`}>{PLANS[k].label} (R$)</label><input id={`pp-${p.id}-${k}`} inputMode="decimal" value={prices[k]} onChange={(e) => setPrices({ ...prices, [k]: e.target.value })} /></div>
        ))}
        <div className="field"><label htmlFor={`pc-${p.id}`}>Pessoas por horário</label><input id={`pc-${p.id}`} type="number" min={1} max={10} value={v.capacity} onChange={(e) => setV({ ...v, capacity: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} /></div>
        <div className="field"><label htmlFor={`pm-${p.id}`}>Formato (texto)</label><input id={`pm-${p.id}`} maxLength={40} value={v.modality} onChange={(e) => setV({ ...v, modality: e.target.value })} /></div>
        <div className="field full">
          <label>Dias com aula</label>
          <div className="chips">{DAY_NAMES.map((d, i) => <label key={d}><input type="checkbox" checked={v.weekdays.includes(i)} onChange={(e) => setV({ ...v, weekdays: e.target.checked ? [...v.weekdays, i] : v.weekdays.filter((x) => x !== i) })} />{d}</label>)}</div>
        </div>
        <div className="field">
          <label htmlFor={`psc-${p.id}`}>Horários</label>
          <select id={`psc-${p.id}`} value={v.schedule} onChange={(e) => setV({ ...v, schedule: e.target.value as 'fixed' })}><option value="fixed">Fixos</option><option value="tide">Pela maré (3 aulas em volta da maré baixa)</option></select>
        </div>
        {v.schedule === 'fixed' && <div className="field"><label htmlFor={`ph-${p.id}`}>Horários fixos</label><input id={`ph-${p.id}`} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="06:00, 07:00, 08:00" /><small className="help">Separe por vírgula. Cada aula dura 1 hora.</small></div>}
        <div className="field full"><label htmlFor={`pd-${p.id}`}>Descrição</label><textarea id={`pd-${p.id}`} maxLength={600} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></div>
        <div className="field full"><label htmlFor={`pmt-${p.id}`}>Ponto de encontro</label><input id={`pmt-${p.id}`} maxLength={400} value={v.meeting} onChange={(e) => setV({ ...v, meeting: e.target.value })} /></div>
        <div className="field"><label htmlFor={`pa-${p.id}`}>Endereço (mapa)</label><input id={`pa-${p.id}`} maxLength={160} value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></div>
        <div className="field">
          <label htmlFor={`pw-${p.id}`}>Calibração da onda: {Math.round(v.waveFactor * 100)}%</label>
          <input id={`pw-${p.id}`} type="range" min={10} max={150} value={Math.round(v.waveFactor * 100)} onChange={(e) => setV({ ...v, waveFactor: Number(e.target.value) / 100 })} />
          <small className="help">Se a previsão mostrar onda maior do que você vê no pico, baixe; se menor, suba. Vale na hora para todos.</small>
        </div>
      </div>
      <label className="check"><input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />Recebendo agendamentos</label>
      <div className="modal-actions"><Btn icon="check" onClick={save}>Salvar {v.short}</Btn></div>
    </section>
  );
}

export function SettingsPage() {
  useTitle('Ajustes');
  const toast = useToast();
  const { data, reload } = useApi<{ settings: S }>('/api/admin/settings');
  const { data: places, reload: reloadPlaces } = useApi<{ places: AdminPlace[] }>('/api/admin/places');
  const [s, setS] = useState<S | null>(null);
  const [busy, setBusy] = useState(false);
  const [pwd, setPwd] = useState({ current: '', next: '' });
  useEffect(() => {
    if (data) setS({ ...data.settings, whatsapp: formatPhoneBR(data.settings.whatsapp) });
  }, [data]);
  if (!s || !places) return <Spinner />;
  const set = <K extends keyof S>(k: K, v: S[K]) => setS({ ...s, [k]: v });
  const save = async () => {
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
  return (
    <div className="page-content">
      <PageTitle title="Ajustes." sub="Regras da escola, Pix, lembretes e locais." action={<Btn icon="check" busy={busy} onClick={save}>Salvar ajustes</Btn>} />
      <section className="card">
        <h3>Escola e Pix</h3>
        <div className="form-grid spacer">
          <div className="field"><label htmlFor="s-school">Nome da escola</label><input id="s-school" maxLength={60} value={s.school} onChange={(e) => set('school', e.target.value)} /></div>
          <div className="field"><label htmlFor="s-ins">Instrutor</label><input id="s-ins" maxLength={60} value={s.instructor} onChange={(e) => set('instructor', e.target.value)} /></div>
          <div className="field"><label htmlFor="s-wa">WhatsApp de contato</label><input id="s-wa" type="tel" value={s.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} /></div>
          <div className="field"><label htmlFor="s-pix">Chave Pix</label><input id="s-pix" maxLength={77} value={s.pixKey} onChange={(e) => set('pixKey', e.target.value)} /><small className="help">Celular, e-mail, CPF/CNPJ ou chave aleatória.</small></div>
          <div className="field"><label htmlFor="s-pixn">Nome do recebedor (como no banco)</label><input id="s-pixn" maxLength={25} value={s.pixName} onChange={(e) => set('pixName', e.target.value)} /></div>
          <div className="field"><label htmlFor="s-pixc">Cidade</label><input id="s-pixc" maxLength={15} value={s.pixCity} onChange={(e) => set('pixCity', e.target.value)} /></div>
        </div>
      </section>
      <section className="card spacer">
        <h3>Agendamento, cancelamento e devolução</h3>
        <div className="form-grid spacer">
          <Num id="s-dep" label="Sinal para garantir a vaga" suffix="%" value={s.depositPct} min={10} max={100} onChange={(n) => set('depositPct', n)} />
          <Num id="s-hold" label="Tempo para o aluno pagar o sinal" suffix="min" value={s.holdMinutes} min={5} max={240} onChange={(n) => set('holdMinutes', n)} help="Depois disso, sem aviso de Pix, o horário volta a ficar livre." />
          <Num id="s-cancel" label="Cancelamento pelo app até" suffix="horas antes" value={s.cancelLimitHours} min={0} max={720} onChange={(n) => set('cancelLimitHours', n)} help="Dentro do prazo, o valor pago fica 'a devolver' e você devolve pelo Pix (pacote: volta como crédito)." />
          <Num id="s-rl" label="Remarcações pelo aluno" suffix="vezes" value={s.rescheduleLimit} min={0} max={5} onChange={(n) => set('rescheduleLimit', n)} />
          <Num id="s-rlh" label="Remarcar pelo app até" suffix="horas antes" value={s.rescheduleLimitHours} min={0} max={720} onChange={(n) => set('rescheduleLimitHours', n)} />
          <Num id="s-min" label="Antecedência mínima para agendar" suffix="horas" value={s.minNoticeHours} min={0} max={72} onChange={(n) => set('minNoticeHours', n)} />
          <Num id="s-hz" label="Agenda aberta para os próximos" suffix="dias" value={s.horizonDays} min={7} max={180} onChange={(n) => set('horizonDays', n)} />
          <Num id="s-p5" label="Validade do pacote de 5" suffix="dias" value={s.pack5Days} min={7} max={365} onChange={(n) => set('pack5Days', n)} />
          <Num id="s-p10" label="Validade do pacote de 10" suffix="dias" value={s.pack10Days} min={7} max={365} onChange={(n) => set('pack10Days', n)} />
        </div>
        <div className="toggle-row">
          <div><strong>Confirmar sozinho as aulas de pacote</strong><small>Aluno com crédito agenda e já fica confirmado. Desligado, você confirma cada uma.</small></div>
          <label className="switch"><input type="checkbox" checked={s.autoConfirm} onChange={(e) => set('autoConfirm', e.target.checked)} /><span /></label>
        </div>
      </section>
      <section className="card spacer">
        <h3>Lembretes</h3>
        <p className="legal-note">Nada é enviado de madrugada: um lembrete que cairia entre 22h e 6h sai às 21h30 da véspera.</p>
        <div className="field spacer"><label>Para o aluno</label><Hours value={s.remindStudentHours} onChange={(v) => set('remindStudentHours', v)} /></div>
        <div className="field"><label>Para você</label><Hours value={s.remindAdminHours} onChange={(v) => set('remindAdminHours', v)} /></div>
        <div className="toggle-row">
          <div><strong>Aviso “hoje tem aula” de manhã</strong><small>Para o aluno (aulas a partir de 1 h depois do aviso) e um resumo do dia para você.</small></div>
          <div className="row">
            {s.remindMorningAt !== null && <input aria-label="Horário do aviso" type="time" value={s.remindMorningAt} onChange={(e) => set('remindMorningAt', e.target.value || '06:30')} />}
            <label className="switch"><input type="checkbox" checked={s.remindMorningAt !== null} onChange={(e) => set('remindMorningAt', e.target.checked ? '06:30' : null)} /><span /></label>
          </div>
        </div>
      </section>
      <section className="card spacer">
        <div className="toggle-row">
          <div><strong>Quiver no app do aluno</strong><small>Desligado, o aluno não vê nada sobre pranchas.</small></div>
          <label className="switch"><input type="checkbox" checked={s.quiverEnabled} onChange={(e) => set('quiverEnabled', e.target.checked)} /><span /></label>
        </div>
      </section>
      <div className="modal-actions"><Btn icon="check" busy={busy} onClick={save}>Salvar ajustes</Btn></div>

      <h2 className="spacer">Locais, preços e horários</h2>
      {places.places.map((p) => <PlaceEditor key={p.id} p={p} onSaved={reloadPlaces} />)}

      <section className="card spacer">
        <h3>Sua senha do painel</h3>
        <div className="form-grid spacer">
          <div className="field"><label htmlFor="pw-c">Senha atual</label><input id="pw-c" type="password" autoComplete="current-password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} /></div>
          <div className="field"><label htmlFor="pw-n">Nova senha (mín. 12)</label><input id="pw-n" type="password" autoComplete="new-password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} /></div>
        </div>
        <div className="modal-actions"><Btn variant="secondary" onClick={async () => { try { await api('/api/admin/security/password', { body: pwd }); toast('Senha trocada. Outros aparelhos foram desconectados.'); setPwd({ current: '', next: '' }); } catch (e) { toast(errorMessage(e)); } }}>Trocar senha</Btn></div>
      </section>
    </div>
  );
}
