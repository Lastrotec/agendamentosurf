// Regras e tipos compartilhados entre o servidor e o app.

export const PLANS = {
  single: { label: 'Aula avulsa', lessons: 1 },
  pack5: { label: 'Pacote 5 aulas', lessons: 5 },
  pack10: { label: 'Pacote 10 aulas', lessons: 10 },
} as const;
export type PlanId = keyof typeof PLANS;
export const PLAN_IDS = Object.keys(PLANS) as PlanId[];

export const LEVELS = ['Primeiro contato', 'Iniciante', 'Intermediário', 'Avançado'] as const;
export const BOARD_TYPES = ['Longboard', 'Softboard', 'Funboard', 'Evolutiva', 'Egg', 'Fish', 'Shortboard'] as const;

export type BookingStatus = 'pending_payment' | 'awaiting' | 'confirmed' | 'done' | 'no_show' | 'cancelled' | 'declined' | 'expired';
export const LIVE_STATUSES: BookingStatus[] = ['pending_payment', 'awaiting', 'confirmed'];
export const STATUS_LABEL: Record<BookingStatus, [string, string]> = {
  pending_payment: ['Aguardando pagamento', 'gray'],
  awaiting: ['Aguardando confirmação', 'orange'],
  confirmed: ['Confirmada', ''],
  done: ['Realizada', ''],
  no_show: ['Falta', 'gray'],
  cancelled: ['Cancelada', 'gray'],
  declined: ['Recusada', 'gray'],
  expired: ['Expirada', 'gray'],
};

export interface Place {
  id: string;
  name: string;
  short: string;
  address: string;
  meeting: string;
  description: string;
  modality: string;
  capacity: number;
  weekdays: number[];
  hours: string[];
  schedule: 'fixed' | 'tide';
  prices: Record<PlanId, number>; // centavos
  imageId: string | null;
  facing: number;
}

export interface Board {
  id: string;
  name: string;
  size: string;
  volume: string;
  type: string;
  level: string;
  description: string;
  imageId: string | null;
  available: boolean;
  condition: 'ok' | 'reparo';
}

/** Configuração pública (sem nada pessoal) entregue ao app do aluno. */
export interface PublicConfig {
  school: string;
  instructor: string;
  whatsapp: string;
  depositPct: number;
  holdMinutes: number;
  cancelLimitHours: number;
  rescheduleLimit: number;
  rescheduleLimitHours: number;
  minNoticeHours: number;
  horizonDays: number;
  packDays: { pack5: number; pack10: number };
  reminders: { hours: number[]; morning: string | null };
  quiverEnabled: boolean;
  paymentsOnline: boolean;
  texts: Texts;
  images: Partial<Record<ImageSlot, string>>;
}

export interface Slot {
  time: string;
  capacity: number;
  taken: number;
  free: number;
  blocked: boolean;
  closed: boolean; // passado ou dentro da antecedência mínima
}

export interface DaySlots {
  date: string;
  open: boolean;
  tide: { period: string; low: string | null; source: 'instrutor' | 'previsão' | 'estimativa' } | null;
  slots: Slot[];
}

// ---------------------------------------------------------------------------
// Textos e imagens editáveis pelo painel
// ---------------------------------------------------------------------------
export const TEXT_FIELDS = {
  heroEyebrow: { label: 'Selo acima do título', max: 60, default: 'AULAS DE 1 HORA · PRANCHA INCLUSA' },
  heroTitle: { label: 'Título principal', max: 80, default: 'Seu próximo encontro com o mar.' },
  heroSubtitle: { label: 'Texto abaixo do título', max: 160, default: 'Reserve com sinal via Pix e garanta sua vaga.' },
  homeGreeting: { label: 'Saudação do aluno', max: 80, default: 'Bora pro mar' },
  homeIntro: { label: 'Apresentação curta', max: 200, default: 'Aulas com Romário de Jesus em Jaguaribe e no Farol da Barra.' },
  quote: { label: 'Frase de destaque', max: 140, default: 'A gente aprende a surfar. E o mar ensina o resto.' },
  quoteSignature: { label: 'Assinatura da frase', max: 40, default: 'THE OUTSIDE WAY OF LIFE' },
  howItWorks: {
    label: 'Como funciona (uma regra por linha)',
    max: 1200,
    default:
      'O agendamento é confirmado com o pagamento do sinal pelo Pix.\nA prancha e a lycra são fornecidas pela escola.\nLeve água, protetor solar e roupa de banho. Chegue 10 minutos antes.',
  },
  bringList: { label: 'Recado na aula marcada', max: 300, default: 'Leve água, protetor solar e roupa de banho. Chegue 10 minutos antes.' },
  signupNote: { label: 'Recado no cadastro', max: 200, default: 'Só pedimos o necessário para o Romário falar com você sobre a aula.' },
  footer: { label: 'Rodapé', max: 120, default: 'Jaguaribe · Farol da Barra · Salvador, BA' },
} as const;
export type TextKey = keyof typeof TEXT_FIELDS;
export type Texts = Record<TextKey, string>;

export const IMAGE_SLOTS = {
  hero: { label: 'Foto principal (início)', fallback: '/img/surf.jpg', maxSide: 1800 },
  instructor: { label: 'Foto do instrutor', fallback: null, maxSide: 900 },
  loginBg: { label: 'Fundo do login e cadastro', fallback: '/img/beach.jpg', maxSide: 1800 },
} as const;
export type ImageSlot = keyof typeof IMAGE_SLOTS;

export function resolveTexts(stored: Partial<Record<string, unknown>> | null | undefined): Texts {
  const out = {} as Texts;
  for (const k of Object.keys(TEXT_FIELDS) as TextKey[]) {
    const v = stored?.[k];
    out[k] = typeof v === 'string' && v.trim() ? v : TEXT_FIELDS[k].default;
  }
  return out;
}

export const imageUrl = (id: string | null | undefined, fallback: string | null = null) => (id ? `/img/${id}` : fallback);

/** Valor do sinal (arredondado para cima em reais inteiros quando possível). */
export function depositFor(totalCents: number, pct: number): number {
  if (pct >= 100) return totalCents;
  return Math.ceil((totalCents * pct) / 100);
}
