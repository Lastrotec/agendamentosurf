import { LOGO_PATH, LOGO_RATIO, LOGO_VIEWBOX } from './logo-paths';

export const BRAND_ORANGE = '#FF591D';
export const BRAND_OLIVE = '#42432F';

/**
 * Logo oficial (fundo transparente), em vetor. Pela altura, porque a arte é vertical.
 * `color`: laranja da marca · `white`: sobre foto ou fundo escuro · `mono`: na cor do texto.
 */
export function Logo({ height = 80, variant = 'color', label = 'Outside Surf School' }: { height?: number; variant?: 'color' | 'white' | 'mono'; label?: string }) {
  const fill = variant === 'color' ? BRAND_ORANGE : variant === 'white' ? '#fff' : 'currentColor';
  return (
    <svg viewBox={LOGO_VIEWBOX} width={Math.round(height * LOGO_RATIO)} height={height} role="img" aria-label={label} className="logo-svg">
      <path d={LOGO_PATH} fill={fill} />
    </svg>
  );
}
