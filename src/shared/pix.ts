// "Pix copia e cola" (BR Code / EMV do Banco Central), com valor e identificador do pedido.

const field = (id: string, value: string) => id + String(value.length).padStart(2, '0') + value;
const ascii = (s: string, max: number) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 .-]/g, '')
    .toUpperCase()
    .trim()
    .slice(0, max);

export function crc16(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function pixPayload({ key, name, city, cents, txid }: { key: string; name: string; city: string; cents: number; txid: string }): string {
  const account = field('00', 'br.gov.bcb.pix') + field('01', key);
  const ref = String(txid || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  const body =
    field('00', '01') +
    field('26', account) +
    field('52', '0000') +
    field('53', '986') +
    (cents > 0 ? field('54', (cents / 100).toFixed(2)) : '') +
    field('58', 'BR') +
    field('59', ascii(name, 25)) +
    field('60', ascii(city, 15)) +
    field('62', field('05', ref)) +
    '6304';
  return body + crc16(body);
}

/** Chave celular no formato do Pix (+55DDDNÚMERO); outras chaves (e-mail, CPF, aleatória) passam como estão. */
export function normalizePixKey(raw: string): string {
  const v = raw.trim();
  if (/^\+?[\d\s()-]{10,16}$/.test(v)) {
    const d = v.replace(/\D/g, '');
    return '+' + (d.startsWith('55') && d.length > 11 ? d : '55' + d);
  }
  return v;
}
