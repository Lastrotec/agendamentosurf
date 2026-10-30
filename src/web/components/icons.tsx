// Ícones de traço (mesmo desenho do app aprovado).
const paths = {
  logout: 'M15 4h4v16h-4 M10 8l-4 4 4 4 M6 12h10', shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z M9 12l2 2 4-4',
  image: 'M4 5h16v14H4z M4 16l5-5 4 4 3-3 4 4 M15.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0', text: 'M5 6h14M12 6v13M8 19h8',
  smartphone: 'M7 3h10v18H7z M11 18h2', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  upload: 'M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4', star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',

  home: 'M3 10 12 3l9 7v11h-6v-7H9v7H3z', calendar: 'M4 5h16v16H4z M8 3v4m8-4v4M4 10h16m-12 4h2m4 0h2m-8 4h2',
  wave: 'M2 14c4 0 3-7 8-7 3 0 4 2 3 4-2-1-4 0-3 2 1 3 7 3 12 1 M2 19q3-3 6 0t6 0 6 0', user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-3a8 8 0 0 1 16 0v3',
  pin: 'M19 10c0 6-7 11-7 11S5 16 5 10a7 7 0 1 1 14 0 M14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0', arrow: 'M4 12h16m-6-6 6 6-6 6', chevron: 'm9 5 7 7-7 7', left: 'm15 5-7 7 7 7',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 7v5l3 2', sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',
  moon: 'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11', bell: 'M5 17h14l-2-4V9a5 5 0 0 0-10 0v4z M10 21h4', board: 'M12 2C5 7 6 18 8 22h8c2-4 3-15-4-20z M12 5v14',
  check: 'm5 12 4 4L19 6', plus: 'M12 5v14M5 12h14', close: 'm6 6 12 12M6 18 18 6', users: 'M14 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0M3 20v-3a7 7 0 0 1 14 0v3M17 4a4 4 0 0 1 0 8m3 3c2 1 2 3 2 5',
  settings: 'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-8 0v6', leaf: 'M20 3C7 1 1 8 6 15s16 2 14-12 M5 21 16 8', download: 'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
  edit: 'm4 16 12-12 4 4L8 20H4zM14 6l4 4', info: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 11v6m0-10v1', card: 'M3 6h18v12H3z M3 10h18 M7 15h3',
  pix: 'M12 2.5 17 7.5 12 12.5 7 7.5z M12 11.5 17 16.5 12 21.5 7 16.5z', camera: 'M4 8h3l2-3h6l2 3h3v11H4z M15.5 13a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0',
  money: 'M3 7h18v10H3z M14.5 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0 M6 10v4m12-4v4', trash: 'M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3',
  tide: 'M2 13q3-3 6 0t6 0 6 0 M2 18q3-3 6 0t6 0 6 0 M12 3v6m-3-3 3 3 3-3', phone: 'M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  send: 'M4 12 20 4l-6 16-3-7z', lock: 'M6 11h12v10H6z M8 11V8a4 4 0 0 1 8 0v3', copy: 'M8 8h12v12H8z M4 16V4h12', block: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M6 6l12 12',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1', chart: 'M4 20V10m6 10V4m6 16v-7m5 7H3', refresh: 'M20 11a8 8 0 1 0-2 6 M20 4v7h-7',
} as const;
export type IconName = keyof typeof paths;

export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return (
    <svg className={`ico ${className}`} aria-hidden="true" viewBox="0 0 24 24">
      <path d={paths[name]} />
    </svg>
  );
}
