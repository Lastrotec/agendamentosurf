// Ícone de perfil: silhueta do mar numa bolinha colorida. Desenhos chapados, sem detalhes.
import { type AvatarId, AVATARS, isAvatar } from '../../shared/avatars';

const R = 'round';
// Cada desenho ocupa ~40×40 no centro de um quadro 64×64; tudo em uma cor (currentColor).
const ART: Record<AvatarId, { label: string; tone: string; el: React.ReactNode }> = {
  prancha: {
    label: 'Prancha',
    tone: 'orange',
    el: (
      <g transform="rotate(32 32 32)">
        <path d="M32 5c5.5 8 8.5 18 8.5 30 0 9-1.6 15.5-4.2 21h-8.6C25.1 50.5 23.5 44 23.5 35c0-12 3-22 8.5-30Z" />
        <path d="M32 9v45" stroke="var(--avatar-bg)" strokeWidth="1.6" />
      </g>
    ),
  },
  surfista: {
    label: 'Surfista',
    tone: 'teal',
    el: (
      <>
        <circle cx="35" cy="14" r="4.6" />
        <path d="M33 21l-5 12M31 25l-11-4M31 25l12 5M28 33l-7 10M28 33l8 5 1 6" fill="none" stroke="currentColor" strokeWidth="4.6" strokeLinecap={R} strokeLinejoin={R} />
        <ellipse cx="31" cy="49" rx="22" ry="3.6" transform="rotate(-6 31 49)" />
      </>
    ),
  },
  onda: {
    label: 'Onda',
    tone: 'teal',
    el: <path d="M10 50c4-18 15-30 29-30 9 0 15 6 15 13 0 6-4 10-9 10-4 0-7-3-7-6 0-2 1-4 3-5-7-1-13 6-15 18Z" />,
  },
  tartaruga: {
    label: 'Tartaruga',
    tone: 'green',
    el: (
      <>
        <ellipse cx="32" cy="34" rx="12" ry="14" />
        <circle cx="32" cy="15" r="5" />
        <ellipse cx="19" cy="25" rx="7" ry="3.6" transform="rotate(-35 19 25)" />
        <ellipse cx="45" cy="25" rx="7" ry="3.6" transform="rotate(35 45 25)" />
        <ellipse cx="21" cy="45" rx="6" ry="3.2" transform="rotate(40 21 45)" />
        <ellipse cx="43" cy="45" rx="6" ry="3.2" transform="rotate(-40 43 45)" />
        <path d="M32 47l3 6h-6Z" />
      </>
    ),
  },
  golfinho: {
    label: 'Golfinho',
    tone: 'teal',
    el: (
      <>
        <path d="M9 41c9-15 22-22 36-20 5 1 9 4 11 8l-6 0c-2 7-8 11-16 12-8 1-14 0-19 3l-6 6 1-6-6-1Z" />
        <path d="M30 22l6-9 2 9Z" />
        <path d="M33 40l1 8 6-7Z" />
      </>
    ),
  },
  peixe: {
    label: 'Peixe',
    tone: 'orange',
    el: (
      <>
        <path d="M14 32c6-10 15-14 24-14 6 0 10 6 10 14s-4 14-10 14c-9 0-18-4-24-14Z" />
        <path d="M46 32l10-10v20Z" />
      </>
    ),
  },
  estrela: {
    label: 'Estrela-do-mar',
    tone: 'orange',
    el: <path d="M32 10l6 15 16 1-12 10 4 16-14-9-14 9 4-16-12-10 16-1Z" stroke="currentColor" strokeWidth="4" strokeLinejoin={R} />,
  },
  concha: {
    label: 'Concha',
    tone: 'sand',
    el: (
      <>
        <path d="M32 48 13 27c4-9 11-14 19-14s15 5 19 14Z" stroke="currentColor" strokeWidth="3" strokeLinejoin={R} />
        <path d="M26 46h12l-2 6h-8Z" />
      </>
    ),
  },
  coqueiro: {
    label: 'Coqueiro',
    tone: 'green',
    el: (
      <>
        <path d="M31 55c0-12 1-22 5-31" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap={R} />
        <path d="M36 23c-6-6-15-6-21-1 7-1 13 0 21 1Z" />
        <path d="M36 23c3-8 11-12 19-10-6 2-12 5-19 10Z" />
        <path d="M36 23c7-3 15 0 18 7-6-3-12-5-18-7Z" />
        <path d="M36 23c-3-6-2-12 3-15-1 5-2 10-3 15Z" />
        <path d="M36 23c-7 0-13 4-15 11 4-5 9-8 15-11Z" />
      </>
    ),
  },
  caranguejo: {
    label: 'Caranguejo',
    tone: 'orange',
    el: (
      <>
        <ellipse cx="32" cy="38" rx="14" ry="9" />
        <path d="M14 22a6 6 0 1 1 6 6l-1 3-3-1Z" />
        <path d="M50 22a6 6 0 1 0-6 6l1 3 3-1Z" />
        <path d="M20 29l4 5M44 29l-4 5M19 38h-7M45 38h7M20 43l-6 5M44 43l6 5" stroke="currentColor" strokeWidth="3.2" strokeLinecap={R} />
      </>
    ),
  },
  polvo: {
    label: 'Polvo',
    tone: 'purple',
    el: (
      <>
        <path d="M18 30c0-10 6-17 14-17s14 7 14 17v6H18Z" />
        <path d="M20 35c-2 7-6 10-9 11M27 36c0 7-2 12-6 15M37 36c0 7 2 12 6 15M44 35c2 7 6 10 9 11M32 36v16" fill="none" stroke="currentColor" strokeWidth="4.2" strokeLinecap={R} />
      </>
    ),
  },
  baleia: {
    label: 'Cauda de baleia',
    tone: 'teal',
    el: (
      <>
        <path d="M32 46c0-8-1-14-4-19-4 2-10 1-15-6 7-1 13 1 17 4h4c4-3 10-5 17-4-5 7-11 8-15 6-3 5-4 11-4 19Z" />
        <path d="M10 50c4-3 8-3 11 0s7 3 11 0 7-3 11 0 7 3 11 0" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap={R} />
      </>
    ),
  },
  gaivota: {
    label: 'Gaivota',
    tone: 'sky',
    el: <path d="M8 30c8-6 16-6 24 4 8-10 16-10 24-4-8-1-15 2-24 12-9-10-16-13-24-12Z" />,
  },
  tubarao: {
    label: 'Barbatana',
    tone: 'sky',
    el: (
      <>
        <path d="M22 44c6-10 9-20 9-30 9 7 14 18 15 30Z" />
        <path d="M8 48c4-3 8-3 12 0s8 3 12 0 8-3 12 0 8 3 12 0" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap={R} />
      </>
    ),
  },
  sol: {
    label: 'Sol',
    tone: 'sand',
    el: (
      <>
        <circle cx="32" cy="32" r="10" />
        <path d="M32 10v6M32 48v6M10 32h6M48 32h6M16.5 16.5l4.2 4.2M43.3 43.3l4.2 4.2M47.5 16.5l-4.2 4.2M20.7 43.3l-4.2 4.2" stroke="currentColor" strokeWidth="4" strokeLinecap={R} />
      </>
    ),
  },
  arraia: {
    label: 'Arraia',
    tone: 'purple',
    el: (
      <>
        <path d="M32 14c4 6 12 11 22 12-6 6-14 10-22 14-8-4-16-8-22-14 10-1 18-6 22-12Z" />
        <path d="M32 38c0 6 2 12 6 17" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap={R} />
      </>
    ),
  },
};

export const AVATAR_OPTIONS = AVATARS.map((id) => ({ id, label: ART[id].label }));

export function Avatar({ id, size = 38, className = '' }: { id: string | null | undefined; size?: number; className?: string }) {
  const a = ART[isAvatar(id) ? id : 'onda'];
  return (
    <span className={`avatar sil ${a.tone} ${className}`} style={{ width: size, height: size }} role="img" aria-label={`Ícone: ${a.label}`}>
      <svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">{a.el}</svg>
    </span>
  );
}
