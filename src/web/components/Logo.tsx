import { LOGO_FIN, LOGO_HAND, LOGO_WORD } from './logo-paths';

export const BRAND_BLUE = '#1F4E96';
export const BRAND_YELLOW = '#F7EC86';

/**
 * Logo original (barbatana + "outside" + letras manuscritas), em vetor.
 * `badge`: no fundo amarelo da marca (funciona igual no tema claro e escuro). `mono`: na cor do texto.
 */
export function Logo({ width = 150, variant = 'badge', label = 'Outside Surf School' }: { width?: number; variant?: 'badge' | 'mono' | 'white'; label?: string }) {
  const color = variant === 'badge' ? BRAND_BLUE : variant === 'white' ? '#fff' : 'currentColor';
  return (
    <svg viewBox="0 0 384 354" width={width} height={(width * 354) / 384} role="img" aria-label={label} className="logo-svg">
      {variant === 'badge' && <rect width="384" height="354" rx="34" fill={BRAND_YELLOW} />}
      <g fill={color}>
        <path d={LOGO_FIN} />
        <path d={LOGO_WORD} />
      </g>
      <g fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: LOGO_HAND }} />
    </svg>
  );
}

/** Só a barbatana (ícone pequeno). */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="40 60 300 165" width={size} height={(size * 165) / 300} aria-hidden="true" className="logo-mark">
      <path d={LOGO_FIN} fill="currentColor" />
    </svg>
  );
}
