// Instalação do app (só aparece para quem usa pelo navegador) e cartão de notificações.
// A etapa de ativação na primeira utilização fica em Onboarding.tsx.
import { useCallback, useEffect, useState } from 'react';

import { errorMessage } from '../lib/api';
import { Link } from '../lib/router';
import { detectPlatform, isStandalone, type Platform, useInstallPrompt } from '../pwa/pwa';
import { disablePush, enablePush, type PushState, readPushState, sendTestPush, syncPush, type Who } from '../pwa/push';
import { Icon } from './icons';
import { Logo } from './Logo';
import { Btn, useToast } from './ui';

type Guide = 'android' | 'ios';
const guideFor = (p: Platform): Guide => (p === 'ios-safari' || p === 'ios-other' ? 'ios' : 'android');

const STEPS: Record<Guide, string[]> = {
  android: ['No Chrome, toque no menu ⋮ no canto de cima.', 'Escolha “Instalar app” (ou “Adicionar à tela inicial”).', 'Confirme em “Instalar”. O ícone da Outside aparece na tela inicial.'],
  ios: [
    'No Safari, toque em Compartilhar (o quadrado com a seta para cima, na barra de baixo).',
    'Role as opções e toque em “Adicionar à Tela de Início”.',
    'Toque em “Adicionar”. Abra o app pelo ícone e ative as notificações.',
  ],
};

/** Gravação do passo a passo (carrega só quando a pessoa dá play). Sem o vídeo, a lista de passos basta. */
function InstallVideo({ guide }: { guide: Guide }) {
  const [missing, setMissing] = useState(false);
  const name = guide === 'ios' ? 'iphone' : 'android';
  if (missing) return null;
  return (
    <figure className="install-video">
      <video
        key={name}
        src={`/videos/como-instalar-${name}.mp4`}
        poster={`/videos/como-instalar-${name}.jpg`}
        controls
        playsInline
        preload="none"
        onError={() => setMissing(true)}
        aria-label={`Vídeo: como instalar o app no ${guide === 'ios' ? 'iPhone' : 'Android'}`}
      >
        <track kind="captions" src={`/videos/como-instalar-${name}.vtt`} srcLang="pt-BR" label="Português" />
      </video>
      <figcaption>Toque para ver o passo a passo</figcaption>
    </figure>
  );
}

export function InstallGuide() {
  const detected = typeof navigator !== 'undefined' ? detectPlatform() : 'unknown';
  const [guide, setGuide] = useState<Guide>(guideFor(detected));
  const install = useInstallPrompt();
  const toast = useToast();
  if (isStandalone()) return <div className="notice ok"><Icon name="check" /><p>O app já está instalado neste aparelho. 🤙</p></div>;
  return (
    <div className="install-guide">
      {install.canPrompt && (
        <Btn full icon="download" onClick={async () => (await install.prompt()) === 'accepted' && toast('App instalado! Abra pelo ícone na tela inicial.')}>
          Instalar agora (1 toque)
        </Btn>
      )}
      {detected === 'in-app' && (
        <div className="notice warn"><Icon name="info" /><p>Você está no navegador do Instagram/WhatsApp, que não instala apps. Toque em ⋯ e escolha “Abrir no navegador”.</p></div>
      )}
      {detected === 'ios-other' && (
        <div className="notice warn"><Icon name="info" /><p>No iPhone, a instalação é pelo <strong>Safari</strong>. Copie o endereço e abra no Safari.</p></div>
      )}
      <div className="seg center">
        <button type="button" className={guide === 'android' ? 'active' : ''} onClick={() => setGuide('android')}>Android</button>
        <button type="button" className={guide === 'ios' ? 'active' : ''} onClick={() => setGuide('ios')}>iPhone</button>
      </div>
      <div className="install-grid">
        <InstallVideo guide={guide} />
        <ol className="install-steps">
          {STEPS[guide].map((t, i) => (
            <li key={i}><b>{i + 1}</b><span>{t}</span></li>
          ))}
        </ol>
      </div>
      {guide === 'ios' && <p className="legal-note">No iPhone a Apple não permite um botão automático de instalação: são só esses 3 toques no Safari.</p>}
    </div>
  );
}

/** Faixa de destaque no topo para quem está no navegador (some no app instalado). */
export function InstallBanner() {
  const install = useInstallPrompt();
  if (isStandalone()) return null;
  return (
    <section className="install-banner">
      <Logo height={70} variant="white" />
      <div>
        <strong>Instale o app da Outside</strong>
        <p>Abre em 1 toque, recebe os lembretes das aulas e não ocupa espaço.</p>
      </div>
      {install.canPrompt ? (
        <Btn icon="download" onClick={() => install.prompt()}>Instalar</Btn>
      ) : (
        <Link to="/instalar" className="btn">Como instalar<Icon name="arrow" /></Link>
      )}
    </section>
  );
}

function usePushState() {
  const [state, setState] = useState<PushState>('loading');
  const refresh = useCallback(() => void readPushState().then(setState, () => setState('unsupported')), []);
  useEffect(refresh, [refresh]);
  return { state, refresh };
}

/** Cartão de notificações (aluno e instrutor). Fica visível enquanto não estiverem ativas. */
export function PushCard({ who, hours }: { who: Who; hours?: number[] }) {
  const { state, refresh } = usePushState();
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => {
    if (state === 'on') syncPush(who).catch(() => {});
  }, [state, who]);
  if (state === 'loading' || state === 'unconfigured') return null;
  const desc =
    who === 'admin'
      ? 'Aviso de cada agendamento, Pix informado, cancelamento e lembrete das aulas.'
      : `Lembrete ${hours?.length ? hours.map((h) => (h >= 24 ? `${h / 24 === 1 ? '1 dia' : `${h / 24} dias`}` : `${h} h`)).join(' e ') + ' antes' : 'antes'} e no dia da aula, confirmação e qualquer mudança.`;
  return (
    <section className={`card push-card ${state === 'on' ? 'on' : 'off'}`}>
      <span className="push-ico"><Icon name="bell" /></span>
      <div>
        <h3>{state === 'on' ? 'Notificações ativas neste aparelho' : 'Ative as notificações'}</h3>
        <p className="muted">{desc}</p>
        {state === 'ios-install' && <p className="muted">No iPhone, as notificações funcionam com o app instalado. <Link to="/instalar" className="link">Ver como instalar</Link>.</p>}
        {state === 'denied' && <p className="muted">Estão bloqueadas para este site. Libere nas configurações do navegador/celular e volte aqui.</p>}
        {state === 'unsupported' && <p className="muted">Este navegador não aceita notificações. Use o Chrome, Edge, Firefox ou Safari atualizado.</p>}
        <div className="row wrap spacer-sm">
          {state === 'off' && (
            <Btn
              icon="bell"
              busy={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await enablePush(who);
                  if (who === 'admin') await sendTestPush().catch(() => {});
                  toast('Notificações ativadas!');
                } catch (e) {
                  toast(errorMessage(e));
                } finally {
                  setBusy(false);
                  refresh();
                }
              }}
            >
              Ativar notificações
            </Btn>
          )}
          {state === 'on' && who === 'admin' && <Btn variant="secondary" small icon="bell" onClick={() => sendTestPush().then(() => toast('Teste enviado.'), (e) => toast(errorMessage(e)))}>Enviar teste</Btn>}
          {state === 'on' && <Btn variant="subtle" small onClick={async () => (await disablePush(who), refresh())}>Desativar</Btn>}
        </div>
      </div>
    </section>
  );
}
