// Validação e sanitização de toda entrada da API (zod). Texto livre: sem caracteres de controle,
// sem marcação HTML, espaços normalizados e tamanho máximo. O app nunca injeta HTML vindo do banco.
import { z } from 'zod';

import { LEVELS, PLAN_IDS, type PlanId, TEXT_FIELDS, type TextKey } from './domain';

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069]/g;

/** Limpa texto: remove controles/bidi, tags e espaços repetidos. `multiline` preserva quebras de linha. */
export function sanitizeText(input: string, multiline = false): string {
  let s = input.normalize('NFC').replace(/\r\n?/g, '\n').replace(CONTROL, '');
  s = s.replace(/<[^>]*>/g, '').replace(/[<>]/g, '');
  if (multiline) {
    s = s
      .split('\n')
      .map((l) => l.replace(/[ \t]+/g, ' ').trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');
  } else s = s.replace(/\s+/g, ' ');
  return s.trim();
}

export const cleanText = (max: number, min = 0) =>
  z
    .string()
    .max(max * 2 + 50, 'Texto muito longo.')
    .transform((s) => sanitizeText(s))
    .pipe(z.string().min(min, min > 0 ? 'Preencha este campo.' : undefined).max(max, `Use no máximo ${max} caracteres.`));

export const cleanMultiline = (max: number) =>
  z
    .string()
    .max(max * 2 + 50, 'Texto muito longo.')
    .transform((s) => sanitizeText(s, true))
    .pipe(z.string().max(max, `Use no máximo ${max} caracteres.`));

export const uuid = z.string().uuid('Identificador inválido.');
export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.');
export const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido.');
export const placeId = z.string().regex(/^[a-z0-9-]{2,30}$/, 'Local inválido.');
export const planId = z.enum(PLAN_IDS as [PlanId, ...PlanId[]]);
export const phoneInput = z.string().min(8, 'Informe o celular com DDD.').max(40);
export const password = z.string().min(1, 'Informe a senha.').max(200);
export const cents = z.number().int().min(0).max(10_000_000);

export const signupSchema = z.object({
  name: cleanText(60, 2).refine((s) => /\p{L}/u.test(s), 'Informe seu nome.'),
  phone: phoneInput,
  password,
  consent: z.literal(true, { error: 'Aceite a política de privacidade para continuar.' }),
  website: z.string().max(0).optional(), // armadilha para robôs (campo invisível)
});

export const loginSchema = z.object({ phone: phoneInput, password });
export const adminLoginSchema = z.object({ email: z.string().trim().toLowerCase().email('E-mail inválido.').max(120), password });
export const totpCodeSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Código de 6 dígitos.') });

export const bookSchema = z.object({
  place: placeId,
  plan: z.union([planId, z.literal('credit')]),
  orderId: uuid.optional(),
  people: z.number().int().min(1).max(2).default(1),
  companion: cleanText(60).optional(),
  date: dateStr,
  time: timeStr,
  idempotencyKey: z.string().min(16).max(80).regex(/^[A-Za-z0-9_-]+$/),
});

export const rescheduleSchema = z.object({ date: dateStr, time: timeStr });

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

// ---------------------------------------------------------------------------
// Painel
// ---------------------------------------------------------------------------
const hoursList = z.array(z.number().int().min(1).max(168)).max(4);

export const settingsSchema = z.object({
  school: cleanText(60, 2),
  instructor: cleanText(60, 2),
  whatsapp: phoneInput,
  pixKey: z.string().trim().min(5).max(77).regex(/^[A-Za-z0-9@.+_ ()-]+$/, 'Chave Pix inválida.'),
  pixName: cleanText(25, 2),
  pixCity: cleanText(15, 2),
  depositPct: z.number().int().min(10).max(100),
  holdMinutes: z.number().int().min(5).max(240),
  autoConfirm: z.boolean(),
  cancelLimitHours: z.number().int().min(0).max(720),
  rescheduleLimit: z.number().int().min(0).max(5),
  rescheduleLimitHours: z.number().int().min(0).max(720),
  minNoticeHours: z.number().int().min(0).max(72),
  horizonDays: z.number().int().min(7).max(180),
  pack5Days: z.number().int().min(7).max(365),
  pack10Days: z.number().int().min(7).max(365),
  remindStudentHours: hoursList,
  remindAdminHours: hoursList,
  remindMorningAt: timeStr.nullable(),
  quiverEnabled: z.boolean(),
});

export const textsSchema = z.object(
  Object.fromEntries(
    (Object.keys(TEXT_FIELDS) as TextKey[]).map((k) => [k, k === 'howItWorks' ? cleanMultiline(TEXT_FIELDS[k].max) : cleanText(TEXT_FIELDS[k].max)]),
  ) as unknown as Record<TextKey, z.ZodType<string>>,
);

export const legalSchema = z.object({ privacyPolicy: cleanMultiline(20000), terms: cleanMultiline(20000) });

export const placeSchema = z.object({
  name: cleanText(60, 2),
  short: cleanText(30, 2),
  address: cleanText(160),
  meeting: cleanText(400),
  description: cleanText(600),
  modality: cleanText(40, 2),
  capacity: z.number().int().min(1).max(10),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
  hours: z.array(timeStr).max(16),
  schedule: z.enum(['fixed', 'tide']),
  prices: z.object({ single: cents.min(100), pack5: cents.min(100), pack10: cents.min(100) }),
  imageId: z.string().regex(/^[a-f0-9]{24}$/).nullable(),
  waveFactor: z.number().min(0.1).max(1.5),
  active: z.boolean(),
});

export const boardSchema = z.object({
  name: cleanText(60, 2),
  size: cleanText(20),
  volume: cleanText(20),
  type: cleanText(30, 2),
  level: z.enum(LEVELS as unknown as [string, ...string[]]),
  description: cleanText(400),
  imageId: z.string().regex(/^[a-f0-9]{24}$/).nullable(),
  available: z.boolean(),
  condition: z.enum(['ok', 'reparo']),
});

export const studentAdminSchema = z.object({
  name: cleanText(60, 2),
  phone: phoneInput.nullable(),
  level: z.enum(LEVELS as unknown as [string, ...string[]]),
  boardId: uuid.nullable(),
  adminNotes: cleanMultiline(2000),
});

export const manualBookingSchema = z.object({
  studentId: uuid.optional(),
  newStudent: z.object({ name: cleanText(60, 2), phone: phoneInput }).optional(),
  place: placeId,
  plan: z.union([planId, z.literal('credit')]),
  people: z.number().int().min(1).max(10).default(1),
  companion: cleanText(60).optional(),
  date: dateStr,
  time: timeStr,
  paid: z.enum(['none', 'deposit', 'full']),
  method: z.enum(['pix', 'card', 'cash', 'other']).default('pix'),
});

export const paymentSchema = z.object({
  amountCents: cents.min(1),
  method: z.enum(['pix', 'card', 'cash', 'other']),
  note: cleanText(200).optional(),
});

export const reasonSchema = z.object({ reason: cleanText(400, 3) });
export const blockSchema = z.object({ place: placeId, date: dateStr, time: timeStr.nullable(), reason: cleanText(120) });
export const dayHoursSchema = z.object({ place: placeId, date: dateStr, hours: z.array(timeStr).max(12).nullable() });
export const tipSchema = z.object({ text: cleanText(600, 1) });
export const imageUploadSchema = z.object({
  data: z.string().max(1_250_000), // base64 (~900 KB)
  mime: z.enum(['image/webp', 'image/jpeg', 'image/png']),
  width: z.number().int().min(1).max(4000),
  height: z.number().int().min(1).max(4000),
});
