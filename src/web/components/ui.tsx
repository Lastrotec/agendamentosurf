import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { Icon, type IconName } from './icons';

// --- Aviso rápido (toast) ---
const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const timer = useRef<number>(0);
  const toast = useCallback((m: string) => {
    setMsg(m);
    setShow(true);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShow(false), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div id="toast" role="status" aria-live="polite" className={show ? 'show' : ''}>
        {msg}
      </div>
    </ToastCtx.Provider>
  );
}

// --- Trava da rolagem do fundo ---
// O <dialog> nativo não impede a página de rolar por trás no iPhone. Fixamos o <body> na posição atual
// (sem pulo) e devolvemos a rolagem ao fechar. Contador: janelas empilhadas liberam só na última.
let locks = 0;
let savedY = 0;
let savedPath = '';
export function lockScroll(): () => void {
  if (locks++ === 0) {
    savedY = window.scrollY;
    savedPath = location.pathname;
    const b = document.body.style;
    b.position = 'fixed';
    b.top = `-${savedY}px`;
    b.left = '0';
    b.right = '0';
    document.documentElement.classList.add('scroll-locked');
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    if (--locks > 0) return;
    const b = document.body.style;
    b.position = b.top = b.left = b.right = '';
    document.documentElement.classList.remove('scroll-locked');
    // Se a janela levou a outra tela, a nova tela começa do topo.
    window.scrollTo(0, location.pathname === savedPath ? savedY : 0);
  };
}
export const useScrollLock = (active = true) => useEffect(() => (active ? lockScroll() : undefined), [active]);

// Altura visível real (desconta o teclado virtual): usada pelas janelas para não ficarem sob o teclado.
if (typeof window !== 'undefined' && window.visualViewport) {
  const vv = window.visualViewport;
  const set = () => document.documentElement.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
  vv.addEventListener('resize', set);
  set();
}

// --- Janela (dialog nativo) ---
export function Modal({ title, onClose, children, className = '' }: { title: ReactNode; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useScrollLock();
  useEffect(() => {
    const d = ref.current!;
    if (!d.open) d.showModal();
    const close = () => onClose();
    d.addEventListener('close', close);
    return () => d.removeEventListener('close', close);
  }, [onClose]);
  return (
    <dialog
      ref={ref}
      id="modal"
      className={className}
      onClick={(e) => {
        if (e.target !== ref.current) return;
        const r = ref.current.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) ref.current.close();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button type="button" className="icon-btn" aria-label="Fechar" onClick={() => ref.current?.close()}>
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function Btn({
  children,
  icon,
  variant = '',
  full,
  small,
  busy,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: IconName; variant?: '' | 'secondary' | 'subtle' | 'danger'; full?: boolean; small?: boolean; busy?: boolean }) {
  return (
    <button type="button" {...rest} disabled={rest.disabled || busy} className={`btn ${variant} ${full ? 'full' : ''} ${small ? 'small' : ''} ${rest.className ?? ''}`}>
      {busy ? <span className="spinner sm" /> : null}
      {children}
      {icon && !busy ? <Icon name={icon} /> : null}
    </button>
  );
}

export function PageTitle({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export const Detail = ({ label, children }: { label: ReactNode; children: ReactNode }) => (
  <div className="detail-row">
    <span>{label}</span>
    <strong>{children}</strong>
  </div>
);

export function Empty({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="card empty">
      <Icon name={icon} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

export const Spinner = ({ label = 'Carregando…' }: { label?: string }) => (
  <div className="card empty">
    <div className="spinner" />
    <p>{label}</p>
  </div>
);

/** Esqueleto de carregamento: mostra o formato da tela enquanto os dados chegam. */
export const Skeleton = ({ rows = 3 }: { rows?: number }) => (
  <div className="skeleton" aria-busy="true" aria-label="Carregando">
    {Array.from({ length: rows }, (_, i) => <i key={i} style={{ height: i === 0 ? 120 : 84 }} />)}
  </div>
);

export function Notice({ icon = 'info', children, tone = '' }: { icon?: IconName; children: ReactNode; tone?: '' | 'warn' | 'ok' }) {
  return (
    <div className={`notice ${tone}`}>
      <Icon name={icon} />
      <div>{children}</div>
    </div>
  );
}

/** Texto do banco exibido com quebras de linha, nunca como HTML. */
export const Multiline = ({ text }: { text: string }) => <span style={{ whiteSpace: 'pre-line' }}>{text}</span>;
