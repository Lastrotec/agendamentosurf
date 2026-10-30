// Primeira configuração do aparelho: tema (aluno) e notificações (aluno logado e instrutor).
// - Tema: aparece uma vez, até a pessoa escolher; depois muda pelo botão do topo ou em Ajustes.
// - Notificações: a permissão do sistema só é pedida depois do toque em "Ativar". A etapa só conta como
//   concluída quando há permissão + inscrição de push válida registrada no servidor. Quando o aparelho não
//   pode receber (bloqueado, sem suporte, iPhone fora do app instalado), explicamos o caminho e seguimos:
//   nunca prendemos a pessoa numa tela que ela não consegue resolver.
import { useEffect, useState } from 'react';

import { errorMessage } from '../lib/api';
import { safeStorage } from '../lib/hooks';
import { Link } from '../lib/router';
import { hasChosenTheme, type ThemePref, useTheme } from '../lib/theme';
import { enablePush, type PushState, readPushState, sendTestPush, syncPush, type Who } from '../pwa/push';
import { Icon } from './icons';
import { Logo } from './Logo';
import { ThemePick } from './ThemePick';
import { Btn, useScrollLock } from './ui';

const PUSH_KEY = (who: Who) => `os-onboard-push-${who}`;
type Step = 'theme' | 'push';

function useSteps(who: Who, loggedIn: boolean) {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [push, setPush] = useState<PushState>('loading');
  useEffect(() => {
    let alive = true;
    const theme = who === 'student' && !hasChosenTheme('student');
    if (!loggedIn) {
      setSteps(theme ? ['theme'] : []);
      return;
    }
    readPushState().then(
      (st) => {
        if (!alive) return;
        setPush(st);
        // Já ativas: só garante que este aparelho está ligado a esta conta (troca de login no mesmo celular).
        if (st === 'on') void syncPush(who).then(() => safeStorage.set('local', PUSH_KEY(who), 'on'), () => {});
        // `os-push-gate-*`: etapa concluída na versão anterior do app.
        const needPush = st !== 'on' && st !== 'unconfigured' && !safeStorage.get('local', PUSH_KEY(who)) && !safeStorage.get('local', `os-push-gate-${who}`);
        setSteps([...(theme ? (['theme'] as Step[]) : []), ...(needPush ? (['push'] as Step[]) : [])]);
      },
      () => alive && setSteps(theme ? ['theme'] : []),
    );
    return () => void (alive = false);
  }, [who, loggedIn]);
  return { steps, push, setPush };
}

function ThemeStep({ onNext }: { onNext: () => void }) {
  const { pref, setPref } = useTheme();
  const [pick, setPick] = useState<ThemePref | null>(pref === 'system' ? null : pref);
  return (
    <>
      <h1 id="onb-title">Escolha o visual do app</h1>
      <p>Você pode trocar quando quiser no botão de sol/lua, no topo.</p>
      <ThemePick value={pick} onChange={(v) => (setPick(v), setPref(v, 'student'))} />
      <Btn full icon="arrow" disabled={!pick} onClick={onNext}>Continuar</Btn>
      <button type="button" className="text-btn center" onClick={() => (setPref('system', 'student'), onNext())}>Seguir o tema do celular</button>
    </>
  );
}

function PushStep({ who, state, setState, onDone }: { who: Who; state: PushState; setState: (s: PushState) => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState(0);
  const finish = (mark: string) => (safeStorage.set('local', PUSH_KEY(who), mark), onDone());
  const items =
    who === 'admin'
      ? ['Novo agendamento e Pix informado na hora', 'Cancelamentos com o valor a devolver', 'Resumo do dia e lembrete de cada aula']
      : ['Confirmação da sua aula', 'Lembrete antes da aula e no dia', 'Qualquer mudança: horário, mar ou cancelamento'];

  const activate = async () => {
    setBusy(true);
    setError(null);
    try {
      await enablePush(who);
      // Confere de verdade: permissão concedida + inscrição existente (o servidor já confirmou o registro).
      const now = await readPushState();
      setState(now);
      if (now !== 'on') throw new Error('Não foi possível confirmar a inscrição deste aparelho. Tente de novo.');
      if (who === 'admin') await sendTestPush().catch(() => {});
      finish('on');
    } catch (e) {
      const now = await readPushState().catch(() => state);
      setState(now);
      if (now !== 'denied') {
        setError(errorMessage(e));
        setFailed((n) => n + 1);
      }
    } finally {
      setBusy(false);
    }
  };

  if (state === 'denied')
    return (
      <>
        <span className="push-ico big"><Icon name="bell" /></span>
        <h1 id="onb-title">Notificações bloqueadas</h1>
        <p>O celular está bloqueando os avisos deste app, e ele não pode perguntar de novo. Para liberar:</p>
        <ul>
          <li><Icon name="settings" /> {isAppleDevice() ? 'Ajustes do iPhone → Notificações → Outside Surf → Permitir' : 'Toque no cadeado ao lado do endereço (ou em Configurações do app) → Notificações → Permitir'}</li>
          <li><Icon name="refresh" /> Depois volte aqui e toque em “Já liberei”</li>
        </ul>
        <Btn full icon="refresh" onClick={async () => setState(await readPushState())}>Já liberei</Btn>
        <button type="button" className="text-btn center" onClick={() => finish('denied')}>Continuar sem notificações</button>
        <small className="muted">Você ainda vê os avisos no sino do app.</small>
      </>
    );
  if (state === 'ios-install')
    return (
      <>
        <span className="push-ico big"><Icon name="smartphone" /></span>
        <h1 id="onb-title">Instale para receber os lembretes</h1>
        <p>No iPhone, a Apple só permite notificações com o app instalado na Tela de Início. Leva 3 toques no Safari.</p>
        <Link to="/instalar" className="btn full" onClick={() => finish('ios-install')}>Ver como instalar<Icon name="arrow" /></Link>
        <button type="button" className="text-btn center" onClick={() => finish('ios-install')}>Agora não</button>
        <small className="muted">Ao abrir pelo ícone, o app pede para ativar.</small>
      </>
    );
  if (state === 'unsupported')
    return (
      <>
        <span className="push-ico big"><Icon name="bell" /></span>
        <h1 id="onb-title">Este navegador não envia notificações</h1>
        <p>Tudo continua funcionando: confirmações e mudanças aparecem no sino do app{who === 'student' ? ' e o instrutor fala com você pelo WhatsApp' : ''}. Para receber lembretes no celular, use o Chrome, Edge, Firefox ou Safari atualizado.</p>
        <Btn full icon="arrow" onClick={() => finish('unsupported')}>Entendi</Btn>
      </>
    );
  return (
    <>
      <span className="push-ico big"><Icon name="bell" /></span>
      <h1 id="onb-title">Ative as notificações</h1>
      <p>{who === 'admin' ? 'É assim que o painel avisa você:' : 'É assim que a gente avisa você sobre as aulas:'}</p>
      <ul>{items.map((t) => <li key={t}><Icon name="check" /> {t}</li>)}</ul>
      {error && <div className="notice warn" role="alert"><Icon name="info" /><div>{error}</div></div>}
      <Btn full icon="bell" busy={busy} onClick={activate}>{failed ? 'Tentar de novo' : 'Ativar notificações'}</Btn>
      {failed > 0 ? (
        <button type="button" className="text-btn center" onClick={() => finish('later')}>Continuar sem notificações</button>
      ) : (
        <small className="muted">Toque em “Permitir” no aviso do celular.</small>
      )}
    </>
  );
}

const isAppleDevice = () => /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

export function Onboarding({ who, loggedIn }: { who: Who; loggedIn: boolean }) {
  const { steps, push, setPush } = useSteps(who, loggedIn);
  const [idx, setIdx] = useState(0);
  const step = steps?.[idx];
  useScrollLock(!!step);
  useEffect(() => setIdx(0), [steps]);
  if (!steps || !step) return null;
  const next = () => setIdx((i) => i + 1);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="onb-title" className="onboard">
      <div className="onboard-inner">
        <Logo height={120} />
        {steps.length > 1 && (
          <div className="steps-dots" aria-label={`Etapa ${idx + 1} de ${steps.length}`}>
            {steps.map((s, i) => <i key={s} className={i <= idx ? 'on' : ''} />)}
          </div>
        )}
        {step === 'theme' ? <ThemeStep onNext={next} /> : <PushStep who={who} state={push} setState={setPush} onDone={next} />}
      </div>
    </div>
  );
}
