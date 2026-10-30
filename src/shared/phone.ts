// Normalização de telefones brasileiros para o formato internacional só com dígitos: 55 + DDD + número.

const VALID_DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export type PhoneResult =
  | { ok: true; e164: string; national: string; mobile: boolean }
  | { ok: false; error: string };

export function normalizeBrazilPhone(input: string, opts: { requireMobile?: boolean } = {}): PhoneResult {
  if (typeof input !== 'string' || input.length > 40) return { ok: false, error: 'Telefone inválido.' };
  // Apenas dígitos, +, espaços, parênteses, pontos e hífens são aceitos.
  if (!/^[\d\s()+.\-]+$/.test(input.trim())) return { ok: false, error: 'Use apenas números no telefone.' };
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);

  if (digits.length !== 10 && digits.length !== 11) {
    return { ok: false, error: 'Informe o telefone com DDD, por exemplo (71) 99999-9999.' };
  }
  const ddd = Number(digits.slice(0, 2));
  if (!VALID_DDDS.has(ddd)) return { ok: false, error: 'DDD inválido.' };

  const number = digits.slice(2);
  const mobile = number.length === 9;
  if (mobile && number[0] !== '9') return { ok: false, error: 'Celular deve começar com 9 após o DDD.' };
  if (!mobile && !/^[2-5]/.test(number)) {
    return { ok: false, error: 'Número incompleto. Celulares têm 9 dígitos após o DDD.' };
  }
  if (/^(\d)\1+$/.test(number)) return { ok: false, error: 'Telefone inválido.' };
  if (opts.requireMobile && !mobile) return { ok: false, error: 'Informe um número de celular.' };
  return { ok: true, e164: `55${digits}`, national: digits, mobile };
}

/** "(71) 99999-9999" a partir de 5571999999999 ou 71999999999. */
export function formatPhoneBR(phone: string | null | undefined): string {
  if (!phone) return '';
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

/** Máscara progressiva para o campo de digitação. */
export function maskPhoneInput(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Oculta parte do número para exibição em telas não autenticadas. */
export function maskPhonePrivate(phone: string): string {
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.length < 6) return '•••';
  return `(${d.slice(0, 2)}) •••••-${d.slice(-4)}`;
}
