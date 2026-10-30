// Datas, dinheiro e telefone no padrão brasileiro (fuso America/Bahia).
export const TZ = 'America/Bahia';
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const addDays = (d: string, n: number) => {
  const x = new Date(d + 'T12:00:00Z');
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
export const fmt = (d: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', ...opts }).format(new Date(d + 'T12:00:00Z'));
export const fmtShort = (d: string) => fmt(d, { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '');
export const fmtLong = (d: string) => fmt(d, { weekday: 'long', day: 'numeric', month: 'long' });
export const weekday = (d: string) => new Date(d + 'T12:00:00Z').getUTCDay();
export const money = (cents: number) => ((cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const initials = (n: string) =>
  String(n)
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
export const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? '';
export const greeting = () => {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};
export const nowHourLocal = () => Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
export const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : fmt(new Date(iso).toISOString().slice(0, 10));
};
export const clock = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
export const whatsappLink = (phone: string, text = '') => `https://wa.me/${phone.replace(/\D/g, '')}${text ? '?text=' + encodeURIComponent(text) : ''}`;
export const DAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
