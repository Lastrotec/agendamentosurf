// Ícones de perfil: silhuetas do mar (sem fotos). Só os identificadores — o desenho fica no app.
export const AVATARS = ['prancha', 'onda', 'tartaruga', 'golfinho', 'peixe', 'estrela', 'concha', 'coqueiro', 'caranguejo', 'polvo', 'baleia', 'gaivota', 'tubarao', 'sol', 'arraia', 'surfista'] as const;
export type AvatarId = (typeof AVATARS)[number];

export const isAvatar = (v: unknown): v is AvatarId => typeof v === 'string' && (AVATARS as readonly string[]).includes(v);

/** Ícone padrão estável para quem ainda não escolheu (sorteado pelo id da conta). */
export function defaultAvatar(seed: string): AvatarId {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATARS[h % AVATARS.length];
}

/** Ícone gravado, ou o padrão da conta. */
export const avatarOf = (r: { id: string; avatar: string | null }): AvatarId => (isAvatar(r.avatar) ? r.avatar : defaultAvatar(r.id));
