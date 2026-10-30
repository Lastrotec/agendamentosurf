export const BRAND_ORANGE = '#FF591D';
export const BRAND_OLIVE = '#42432F';
const RATIO = 1608 / 2225; // largura / altura da arte (vertical)

/**
 * Logo oficial (fundo transparente), em vetor. Pela altura, porque a arte é vertical.
 * Arquivo em /brand (cache do navegador e do app instalado), fora do JavaScript: deixa o app mais leve.
 * `color`: laranja da marca · `white`: sobre foto ou fundo escuro · `mono`: na cor do texto.
 */
export function Logo({ height = 80, variant = 'color', label = 'Outside Surf School' }: { height?: number; variant?: 'color' | 'white' | 'mono'; label?: string }) {
  const width = Math.round(height * RATIO);
  if (variant === 'mono')
    return <span role="img" aria-label={label} className="logo-svg logo-mono" style={{ width, height }} />;
  return <img src={variant === 'white' ? '/brand/logo-branca.svg' : '/brand/logo.svg'} width={width} height={height} alt={label} className="logo-svg" decoding="async" draggable={false} />;
}
