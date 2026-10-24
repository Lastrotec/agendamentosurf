'use strict';
/* =========================================================================
   Outside Surf School · Romário de Jesus
   Agendamento de aulas, pagamento (gateway simulado), quiver e painel do instrutor.
   ========================================================================= */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const paths = {
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
};
const icon = n => `<svg class="ico" aria-hidden="true" viewBox="0 0 24 24"><path d="${paths[n] || paths.wave}"/></svg>`;
const btn = (label, action, cls = '', ic = '', extra = '') => `<button type="button" class="btn ${cls}" data-action="${action}" ${extra}>${label}${ic ? icon(ic) : ''}</button>`;

/* ---------- Datas e formatação ---------- */
const TZ = 'America/Bahia';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const fmt = (d, opts = { day: 'numeric', month: 'long' }) => new Intl.DateTimeFormat('pt-BR', opts).format(new Date(d + 'T12:00:00'));
const fmtShort = d => fmt(d, { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '');
const weekday = d => new Date(d + 'T12:00:00').getDay();
const addHour = t => String(+t.slice(0, 2) + 1).padStart(2, '0') + t.slice(2);
const startsAt = (d, t) => new Date(`${d}T${t}:00-03:00`).getTime();
const isPastSlot = (d, t) => startsAt(d, t) < Date.now();
const money = n => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ago = ts => { const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : fmt(new Date(ts).toISOString().slice(0, 10)); };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const shortCode = () => 'OS' + Math.random().toString(36).slice(2, 7).toUpperCase();
const initials = n => String(n).split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const greeting = () => { const h = +new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }).format(new Date()); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
const DAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/* ---------- Regras da escola ---------- */
const levels = ['Primeiro contato', 'Iniciante', 'Intermediário', 'Avançado'];
const BOARD_TYPES = ['Longboard', 'Softboard', 'Funboard', 'Evolutiva', 'Egg', 'Fish', 'Shortboard'];
const PLANS = {
  single: { label: 'Aula avulsa', lessons: 1, validity: 0 },
  pack5: { label: 'Pacote 5 aulas', lessons: 5, validity: 60 },
  pack10: { label: 'Pacote 10 aulas', lessons: 10, validity: 90 },
};
const STATUS = {
  pending_payment: ['Aguardando pagamento', 'gray'], awaiting: ['Aguardando confirmação', 'orange'], confirmed: ['Confirmada', ''],
  done: ['Realizada', ''], no_show: ['Falta', 'gray'], cancelled: ['Cancelada', 'gray'], declined: ['Recusada', 'gray'], expired: ['Expirada', 'gray'],
};
const LIVE = ['awaiting', 'confirmed'];
const statusBadge = b => `<span class="badge ${STATUS[b.status][1]}">${STATUS[b.status][0].toUpperCase()}</span>`;

/* ---------- Maré (estimativa) ----------
   Semidiurna: ~12h25min entre marés baixas. Serve como sugestão inicial;
   o instrutor ajusta pela tábua de marés no painel. */
const TIDE_REF = Date.parse('2026-10-24T05:52:00-03:00'), TIDE_PERIOD = 12.4206 * 3600e3;
function estimateTide(date) {
  const from = startsAt(date, '06:00'), to = startsAt(date, '16:00');
  let low = TIDE_REF + Math.ceil((from - 3600e3 - TIDE_REF) / TIDE_PERIOD) * TIDE_PERIOD;
  if (low > to) low -= TIDE_PERIOD;
  const local = new Date(low - 3 * 3600e3), h = local.getUTCHours(), m = local.getUTCMinutes();
  const start = Math.min(14, Math.max(6, h - 1));
  return { period: start < 12 ? 'manhã' : 'tarde', hours: [0, 1, 2].map(i => String(start + i).padStart(2, '0') + ':00'), low: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, estimated: true };
}
const tideFor = date => state.tides[date] || forecastTide(date) || estimateTide(date);

/* ---------- Dados iniciais ---------- */
const STORE_KEY = 'outside-surf-v2';
function seed() {
  const t = today();
  const classDays = n => { const out = []; let d = t; while (out.length < n) { d = addDays(d, 1); if (weekday(d) !== 2) out.push(d); } return out; };
  const pastDays = n => { const out = []; let d = t; while (out.length < n) { d = addDays(d, -1); if (weekday(d) !== 2) out.push(d); } return out; };
  const [d1, d2, d3] = classDays(3), [p1, p2, p3, p4] = pastDays(9).filter((_, i) => i % 2);
  const s = {
    version: 2,
    settings: { school: 'Outside Surf School', instructor: 'Romário de Jesus', phone: '71992208398', pixKey: '+5571992208398', pixName: 'Romário de Jesus Gomes', city: 'Salvador', depositPct: 50, autoConfirm: false, holdMinutes: 30 },
    places: [
      { id: 'jaguaribe', name: 'Praia de Jaguaribe', short: 'Jaguaribe', area: 'Salvador, BA', image: 'beach.jpg', modality: 'Individual', capacity: 1, days: [0, 1, 3, 4, 5, 6], hours: ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00'], schedule: 'fixed', prices: { single: 150, pack5: 700, pack10: 1400 }, address: 'Praia de Jaguaribe, Salvador - BA', meeting: 'Orla de Jaguaribe. O ponto exato é confirmado pelo instrutor no WhatsApp.', description: 'Aulas individuais de 1 hora, com atenção total do instrutor. Horários das 6h às 12h.' },
      { id: 'farol', name: 'Farol da Barra', short: 'Farol da Barra', area: 'Salvador, BA', image: 'coast.jpg', modality: 'Até 2 pessoas', capacity: 2, days: [0, 1, 3, 4, 5, 6], hours: [], schedule: 'tide', prices: { single: 200, pack5: 900, pack10: 1800 }, address: 'Farol da Barra, Salvador - BA', meeting: 'Em frente ao Farol da Barra, na faixa de areia. Confirme o ponto com o instrutor.', description: 'Aulas para até duas pessoas no mesmo horário. Os horários seguem a maré: pela manhã ou à tarde.' },
    ],
    tides: {}, blocks: [],
    boards: [
      { id: 'b1', name: 'Longboard Amarela', size: '9’0”', volume: '75 L', type: 'Longboard', level: 'Primeiro contato', image: 'boards/longboard-amarela.png', available: true, condition: 'ok', desc: 'Muita flutuação e estabilidade para as primeiras ondas em pé.' },
      { id: 'b2', name: 'Longboard Azul', size: '9’2”', volume: '78 L', type: 'Longboard', level: 'Iniciante', image: 'boards/longboard-azul.png', available: true, condition: 'ok', desc: 'Remada fácil e deslize suave nas ondas pequenas de Jaguaribe.' },
      { id: 'b3', name: 'Funboard Verde', size: '7’6”', volume: '55 L', type: 'Funboard', level: 'Iniciante', image: 'boards/funboard-verde.png', available: true, condition: 'ok', desc: 'A transição ideal entre o longboard e as pranchas menores.' },
      { id: 'b4', name: 'Evolutiva Cinza', size: '7’2”', volume: '48 L', type: 'Evolutiva', level: 'Intermediário', image: 'boards/evolutiva-cinza.png', available: true, condition: 'ok', desc: 'Para quem já fica em pé e quer começar a fazer as primeiras curvas.' },
      { id: 'b5', name: 'Egg Coral', size: '6’8”', volume: '45 L', type: 'Egg', level: 'Intermediário', image: 'boards/egg-coral.png', available: true, condition: 'ok', desc: 'Divertida e solta, boa para ondas mais cheias do Farol.' },
      { id: 'b6', name: 'Fish Branca', size: '5’10”', volume: '34 L', type: 'Fish', level: 'Avançado', image: 'boards/fish-branca.png', available: false, condition: 'ok', desc: 'Prancha pessoal do instrutor. Não disponível para aulas.' },
      { id: 'b7', name: 'Shortboard Machete', size: '5’11”', volume: '28 L', type: 'Shortboard', level: 'Avançado', image: 'boards/shortboard-rosa.png', available: false, condition: 'reparo', desc: 'Em reparo na rabeta.' },
    ],
    students: [
      { id: 's1', name: 'Camila Rocha', email: 'camila@exemplo.com', phone: '(71) 99999-0001', level: 'Iniciante', board: 'b2', notes: [{ text: 'Trabalhar a posição dos pés antes de entrar na água.', date: p2 }], shared: [{ text: 'Sua remada está evoluindo! Na próxima aula vamos trabalhar o tempo de levantar na prancha.', date: p1 }] },
      { id: 's2', name: 'João Vitor', email: 'joao@exemplo.com', phone: '(71) 99999-0002', level: 'Intermediário', board: 'b4', notes: [], shared: [] },
      { id: 's3', name: 'Marina Costa', email: 'marina@exemplo.com', phone: '(71) 99999-0003', level: 'Iniciante', board: 'b1', notes: [], shared: [] },
      { id: 's4', name: 'Pedro Almeida', email: 'pedro@exemplo.com', phone: '(71) 99999-0004', level: 'Primeiro contato', board: 'b1', notes: [], shared: [] },
      { id: 's5', name: 'Beatriz Santos', email: 'bia@exemplo.com', phone: '(71) 99999-0005', level: 'Avançado', board: 'b5', notes: [], shared: [] },
      { id: 's6', name: 'Lucas Ribeiro', email: 'lucas@exemplo.com', phone: '(71) 99999-0006', level: 'Iniciante', board: 'b3', notes: [], shared: [] },
    ],
    orders: [], bookings: [], payments: [], inbox: [],
  };
  const ts = d => startsAt(d, '05:00');
  const order = (id, student, place, plan, paid, method, created, people = 1, companion = '') => {
    const total = s.places.find(p => p.id === place).prices[plan] * (plan === 'single' ? people : 1);
    s.orders.push({ id, code: shortCode(), student, place, plan, people, companion, total, paid, createdAt: ts(created), expiresAt: PLANS[plan].validity ? addDays(created, PLANS[plan].validity) : null, status: paid >= total ? 'paid' : paid > 0 ? 'active' : 'pending' });
    if (paid) s.payments.push({ id: uid(), orderId: id, student, amount: paid, method, kind: paid >= total ? 'integral' : 'sinal', status: 'paid', at: ts(created) + 3600e3, txid: 'TX' + shortCode() });
  };
  const booking = (orderId, student, place, date, time, status, board, extra = {}) => s.bookings.push({ id: uid(), code: shortCode(), orderId, student, place, date, time, people: s.orders.find(o => o.id === orderId).people, status, board, rescheduled: 0, createdAt: ts(date) - 4 * 86400e3, history: [], ...extra });
  const farol = d => estimateTide(d).hours;

  order('o1', 's1', 'jaguaribe', 'pack5', 350, 'pix', addDays(t, -20));
  booking('o1', 's1', 'jaguaribe', p3, '07:00', 'done', 'b2');
  booking('o1', 's1', 'jaguaribe', p1, '07:00', 'done', 'b2');
  booking('o1', 's1', 'jaguaribe', d1, '07:00', 'confirmed', 'b2');
  order('o2', 's2', 'farol', 'single', 100, 'card', addDays(t, -1));
  booking('o2', 's2', 'farol', d1, farol(d1)[0], 'awaiting', 'b4', { createdAt: Date.now() - 50 * 60e3 });
  order('o3', 's3', 'jaguaribe', 'single', 75, 'pix', t);
  booking('o3', 's3', 'jaguaribe', d1, '08:00', 'awaiting', 'b1', { createdAt: Date.now() - 12 * 60e3 });
  order('o4', 's4', 'farol', 'single', 200, 'pix', addDays(t, -2), 2, 'Rafael Almeida');
  booking('o4', 's4', 'farol', d2, farol(d2)[1], 'confirmed', 'b1');
  order('o5', 's6', 'jaguaribe', 'single', 0, null, t);
  booking('o5', 's6', 'jaguaribe', d2, '09:00', 'pending_payment', 'b3', { holdUntil: Date.now() + 22 * 60e3, createdAt: Date.now() - 8 * 60e3 });
  order('o6', 's5', 'farol', 'pack10', 1800, 'card', addDays(t, -30));
  booking('o6', 's5', 'farol', p4, farol(p4)[0], 'done', 'b5');
  booking('o6', 's5', 'farol', p2, farol(p2)[0], 'done', 'b5');
  booking('o6', 's5', 'farol', d3, farol(d3)[0], 'confirmed', 'b5');
  order('o7', 's2', 'jaguaribe', 'single', 150, 'pix', p3);
  booking('o7', 's2', 'jaguaribe', p2, '09:00', 'no_show', 'b4');
  if (weekday(t) !== 2) {
    order('o8', 's6', 'jaguaribe', 'single', 75, 'card', addDays(t, -3));
    booking('o8', 's6', 'jaguaribe', t, '10:00', 'confirmed', 'b3');
    order('o9', 's3', 'farol', 'single', 200, 'pix', addDays(t, -3));
    booking('o9', 's3', 'farol', t, farol(t)[2], 'confirmed', 'b1');
  }
  const b2 = s.bookings.find(b => b.orderId === 'o2'), b3 = s.bookings.find(b => b.orderId === 'o3');
  s.inbox.push(
    { id: uid(), to: 'admin', title: 'Novo agendamento · sinal pago', body: `João Vitor · Farol da Barra · ${fmtShort(d1)} às ${b2.time} · ${money(100)} no cartão`, at: b2.createdAt, read: false, booking: b2.id },
    { id: uid(), to: 'admin', title: 'Novo agendamento · sinal pago', body: `Marina Costa · Jaguaribe · ${fmtShort(d1)} às 08:00 · ${money(75)} via Pix`, at: b3.createdAt, read: false, booking: b3.id },
    { id: uid(), to: 's1', title: 'Aula confirmada', body: `Romário confirmou sua aula de ${fmtShort(d1)} às 07:00 em Jaguaribe.`, at: Date.now() - 86400e3, read: false },
  );
  return s;
}

let state;
try { state = JSON.parse(localStorage.getItem(STORE_KEY)); if (state?.version !== 2) state = seed(); } catch { state = seed(); }
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch { toast('O armazenamento deste navegador está cheio. Remova fotos de pranchas antigas.'); }
}

/* ---------- Estado da interface ---------- */
let role = 'student', page = 'home', tab = 'upcoming', reqTab = 'awaiting', studentFilter = '', selectedStudent = 's1', reschedule = null, installPrompt = null;
let agendaDate = today(), agendaStart = today();
let bk = { place: null, plan: 'single', people: 1, companion: '', date: null, time: null, orderId: null, start: today() };
let pay = null, cut = { img: null, tol: 28 }, pushInfo = null;
let theme = localStorage.getItem('outside-theme') || 'system';

/* ---------- Acesso aos dados ---------- */
const S = () => state.settings;
const me = () => getStudent('s1');
const getPlace = id => state.places.find(p => p.id === id);
const getStudent = id => state.students.find(s => s.id === id);
const getBoard = id => state.boards.find(b => b.id === id);
const getOrder = id => state.orders.find(o => o.id === id);
const getBooking = id => state.bookings.find(b => b.id === id);
const isLive = b => LIVE.includes(b.status) || (b.status === 'pending_payment' && b.holdUntil > Date.now());
const deposit = o => Math.round(o.total * S().depositPct) / 100;
const remaining = o => Math.max(0, Math.round((o.total - o.paid) * 100) / 100);
const creditsUsed = o => state.bookings.filter(b => b.orderId === o.id && !['cancelled', 'declined', 'expired'].includes(b.status)).length;
const creditsLeft = o => PLANS[o.plan].lessons - creditsUsed(o);
const byTime = (a, b) => (a.date + a.time).localeCompare(b.date + b.time);
const placeName = id => getPlace(id)?.short || '';
const whatsapp = (phone, text = '') => `https://wa.me/55${String(phone).replace(/\D/g, '').replace(/^55/, '')}${text ? '?text=' + encodeURIComponent(text) : ''}`;
const phoneLabel = p => { const d = String(p).replace(/\D/g, '').replace(/^55/, ''); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : p; };

// Pedidos com saldo em aberto: já têm sinal ou ainda seguram um horário.
const openOrders = () => state.orders.filter(o => ['active', 'pending'].includes(o.status) && (o.paid > 0 || state.bookings.some(b => b.orderId === o.id && isLive(b))));
function activePackages(studentId, placeId) {
  return state.orders.filter(o => o.student === studentId && o.plan !== 'single' && (!placeId || o.place === placeId) && ['active', 'paid'].includes(o.status) && o.expiresAt >= today() && creditsLeft(o) > 0);
}
function occupancy(place, date, time, ignore) {
  return state.bookings.filter(b => b.id !== ignore && b.place === place && b.date === date && b.time === time && isLive(b)).reduce((n, b) => n + (b.people || 1), 0);
}
const dayBlock = (place, date) => state.blocks.find(x => x.place === place && x.date === date && !x.time);
const slotBlock = (place, date, time) => state.blocks.find(x => x.place === place && x.date === date && x.time === time) || dayBlock(place, date);
const isClassDay = (place, date) => getPlace(place).days.includes(weekday(date));
function slotsFor(placeId, date, ignore) {
  const p = getPlace(placeId);
  if (!p || !isClassDay(placeId, date)) return [];
  const hours = p.schedule === 'tide' ? tideFor(date).hours : p.hours;
  return hours.map(time => {
    const taken = occupancy(placeId, date, time, ignore), block = slotBlock(placeId, date, time);
    return { place: placeId, date, time, end: addHour(time), capacity: p.capacity, taken, free: p.capacity - taken, block, past: isPastSlot(date, time), soon: startsAt(date, time) - Date.now() < 2 * 3600e3 };
  });
}
const openForStudents = s => !s.block && !s.soon && s.free > 0;
function suggestBoard(student) {
  const avail = state.boards.filter(b => b.available && b.condition === 'ok');
  if (!avail.length) return null;
  const pref = getBoard(student.board);
  if (pref && pref.available && pref.condition === 'ok') return pref.id;
  const vol = b => parseFloat(b.volume) || 0, sorted = avail.slice().sort((a, b) => vol(b) - vol(a));
  const idx = Math.min(sorted.length - 1, Math.max(0, levels.indexOf(student.level)));
  return sorted[Math.round(idx / 3 * (sorted.length - 1))].id;
}

/* Expira reservas sem pagamento depois do prazo de bloqueio do horário. */
function sweep() {
  let changed = false;
  for (const b of state.bookings) if (b.status === 'pending_payment' && !(b.holdUntil > Date.now())) { b.status = 'expired'; changed = true; }
  for (const o of state.orders) if (o.status === 'pending' && o.paid === 0 && !state.bookings.some(b => b.orderId === o.id && isLive(b))) { o.status = 'expired'; changed = true; }
  if (changed) save();
}

/* ---------- Notificações ---------- */
function inbox(to, title, body, booking) {
  state.inbox.push({ id: uid(), to, title, body, at: Date.now(), read: false, booking });
  if (state.inbox.length > 120) state.inbox.splice(0, state.inbox.length - 120);
}
async function notifyAdmin(title, body, booking) {
  inbox('admin', title, body, booking);
  save();
  const result = await Push.notifyTeacher({ title, body, tag: booking ? 'booking-' + booking : 'outside', url: './?admin=1' + (booking ? '&booking=' + booking : '') }).catch(() => ({ via: 'none' }));
  return result;
}
const myInbox = () => state.inbox.filter(n => n.to === (role === 'admin' ? 'admin' : me().id)).sort((a, b) => b.at - a.at);
const unread = () => myInbox().filter(n => !n.read).length;

/* ---------- Tema e utilidades de UI ---------- */
function applyTheme() { document.body.classList.toggle('dark', theme === 'dark' || theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches); }
applyTheme();
function toast(t) { $('#toast').textContent = t; $('#toast').classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').classList.remove('show'), 4200); }
function modal(title, body, cls = '') {
  const m = $('#modal');
  m.className = cls;
  m.innerHTML = `<div class="modal-head"><h2>${title}</h2><button type="button" class="icon-btn" data-action="close" aria-label="Fechar">${icon('close')}</button></div>${body}`;
  if (!m.open) m.showModal();
}
function close() { const m = $('#modal'); if (m.open) m.close(); m.innerHTML = ''; stopPixTimer(); pay = null; }
function go(p) { page = p; render(); window.scrollTo({ top: 0, behavior: 'instant' }); }
const title = (t, p, action = '') => `<div class="page-heading"><div><h1>${t}</h1><p>${p}</p></div>${action}</div>`;
const detail = (label, value) => `<div class="detail-row"><span>${label}</span><strong>${value}</strong></div>`;

/* =========================================================================
   Layout
   ========================================================================= */
const navs = () => role === 'student'
  ? [['home', 'home', 'Início'], ['book', 'calendar', 'Agendar'], ['forecast', 'tide', 'Previsão'], ['lessons', 'wave', 'Minhas aulas'], ['boards', 'board', 'Pranchas'], ['profile', 'user', 'Perfil']]
  : [['home', 'chart', 'Painel'], ['agenda', 'calendar', 'Agenda'], ['requests', 'list', 'Reservas'], ['forecast', 'tide', 'Previsão'], ['quiver', 'board', 'Quiver'], ['students', 'users', 'Alunos'], ['finance', 'money', 'Financeiro']];
function navBadge(id) {
  if (role === 'admin' && id === 'requests') { const n = state.bookings.filter(b => b.status === 'awaiting').length; return n ? `<i class="nav-badge">${n}</i>` : ''; }
  if (role === 'student' && id === 'lessons') { const n = state.bookings.filter(b => b.student === me().id && b.status === 'pending_payment' && isLive(b)).length; return n ? `<i class="nav-badge">${n}</i>` : ''; }
  return '';
}
function render() {
  sweep();
  applyTheme();
  const n = navs(), u = unread(), admin = role === 'admin';
  const activeNav = page === 'student' ? 'students' : page;
  $('#app').innerHTML = `${!navigator.onLine ? '<div class="offline">Você está offline. Conecte-se para agendar ou pagar.</div>' : ''}
  <aside class="sidebar">
    <a href="#" class="brand" data-action="nav:home"><svg viewBox="0 0 60 70" aria-hidden="true"><path d="M3 40c12-2 9-21 22-29 9-6 19-6 28-1-18 4-17 17-12 24 3 4 7 5 13 6v4H3z"/><path d="M3 54q5-8 10 0t10 0 10 0 10 0 10 0" fill="none" stroke="currentColor" stroke-width="2"/></svg><div class="brand-name">outside<small>SURF SCHOOL</small></div></a>
    <div class="navlabel">${admin ? 'Painel do instrutor' : 'Seu espaço'}</div>
    <nav class="nav" aria-label="Navegação principal">${n.map(([id, ic, l]) => `<button type="button" data-action="nav:${id}" class="${activeNav === id ? 'active' : ''}" ${activeNav === id ? 'aria-current="page"' : ''}>${icon(ic)}<span>${l}</span>${navBadge(id)}</button>`).join('')}</nav>
    <div class="sidebar-bottom">
      <div class="ocean-note">${icon('wave')}<h4>${admin ? 'Boas ondas, ' + esc(S().instructor.split(' ')[0]) + '.' : 'O mar está chamando.'}</h4><p>${admin ? 'Confirme os pedidos e mantenha o quiver em dia.' : 'Desconecte da rotina.<br>Reconecte com você.'}</p></div>
      <button type="button" class="small-link" data-action="settings">${icon('settings')}${admin ? 'Configurações' : 'Preferências'}</button>
      <button type="button" class="small-link" data-action="install">${icon('download')}Instalar aplicativo</button>
      <div class="user-mini"><div class="avatar">${admin ? initials(S().instructor) : initials(me().name)}</div><div><strong>${admin ? esc(S().instructor) : esc(me().name)}</strong><small>${admin ? 'Instrutor · administrador' : esc(me().level)}</small></div></div>
    </div>
  </aside>
  <main class="main">
    <header class="topbar">
      <div class="breadcrumb">${esc(S().school)} <span>/</span><span>${page === 'student' ? 'Ficha do aluno' : page === 'places' ? 'Locais' : n.find(x => x[0] === page)?.[2] || 'Início'}</span></div>
      <a class="mobile-brand" href="#" data-action="nav:home">outside.</a>
      <div class="top-actions">
        <span class="demo">Demonstração</span>
        <div class="role-switch" aria-label="Alternar perfil de demonstração"><button type="button" data-action="role:student" class="${!admin ? 'active' : ''}">Aluno</button><button type="button" data-action="role:admin" class="${admin ? 'active' : ''}">Instrutor</button></div>
        <button type="button" class="icon-btn" data-action="theme" aria-label="Alternar tema">${icon(document.body.classList.contains('dark') ? 'sun' : 'moon')}</button>
        <button type="button" class="icon-btn bell" data-action="notices" aria-label="Notificações${u ? ` (${u} novas)` : ''}">${icon('bell')}${u ? `<i>${u > 9 ? '9+' : u}</i>` : ''}</button>
      </div>
    </header>
    ${renderPage()}
    <footer class="footer"><span>${icon('wave')} ${esc(S().school.toUpperCase())} · ${esc(S().instructor.toUpperCase())}</span><span>Jaguaribe · Farol da Barra · Salvador, BA</span></footer>
  </main>`;
  if (admin && page === 'home') refreshPushStatus();
}
function renderPage() {
  if (role === 'admin') {
    return ({ home: adminHome, agenda, requests, quiver, students, student: () => studentProfile(getStudent(selectedStudent)), finance, places, forecast: forecastPage })[page]?.() || adminHome();
  }
  return ({ home, book, lessons, boards: boardGallery, profile, places, forecast: forecastPage })[page]?.() || home();
}

/* =========================================================================
   Componentes
   ========================================================================= */
function boardImg(b, cls = '') {
  if (!b) return `<div class="board-empty ${cls}">${icon('board')}</div>`;
  return `<img class="board-img ${cls}" src="${esc(b.image)}" alt="${esc(b.name)} ${esc(b.size)}" loading="lazy">`;
}
function boardCard(b, { student = false, admin = false, eyebrow = '' } = {}) {
  if (!b) return `<section class="card board-card"><div class="eyebrow">${eyebrow || 'SUA PRANCHA'}</div><div class="board-title"><h3>A definir</h3>${icon('board')}</div><div class="board-stage">${boardImg(null)}</div><p class="muted" style="font-size:12px">O instrutor escolhe a prancha ideal para a sua aula.</p></section>`;
  return `<section class="card board-card ${b.available ? '' : 'unavailable'}">
    <div class="row between"><div class="eyebrow">${eyebrow || (student ? 'SUA PRANCHA NA PRÓXIMA AULA' : esc(b.type).toUpperCase())}</div>${admin ? `<span class="badge ${b.available && b.condition === 'ok' ? '' : 'gray'}">${b.condition === 'reparo' ? 'EM REPARO' : b.available ? 'DISPONÍVEL' : 'SÓ DO INSTRUTOR'}</span>` : ''}</div>
    <div class="board-title"><h3>${esc(b.name)}</h3>${icon('board')}</div>
    <div class="board-stage">${boardImg(b)}</div>
    <div class="board-measures"><div><small>TAMANHO</small><strong>${esc(b.size)}</strong></div><div><small>VOLUME</small><strong>${esc(b.volume)}</strong></div><div><small>NÍVEL</small><strong style="font-size:11px">${esc(b.level)}</strong></div></div>
    ${admin ? `<div class="board-actions"><label class="switch"><input type="checkbox" data-toggle-board="${b.id}" ${b.available ? 'checked' : ''} ${b.condition !== 'ok' ? 'disabled' : ''}><span></span>Liberar para alunos</label><button type="button" class="text-btn" data-action="edit-board:${b.id}">Editar ${icon('edit')}</button></div>` : `<button type="button" class="text-btn" data-action="board:${b.id}">Conhecer a prancha ${icon('arrow')}</button>`}
  </section>`;
}
function placeCard(p, action = 'place:' + p.id) {
  return `<button type="button" class="place" data-action="${action}"><div class="place-img"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy"><span class="badge">${icon(p.capacity > 1 ? 'users' : 'user')} ${esc(p.modality).toUpperCase()}</span></div><div class="place-body"><div><h3>${esc(p.name)}</h3><p>${p.schedule === 'tide' ? 'Horários conforme a maré' : 'Das 6h às 12h'} · a partir de ${money(p.prices.pack10 / 10)}/aula</p></div>${icon('arrow')}</div></button>`;
}
function lessonCard(b, admin = false) {
  const p = getPlace(b.place), st = getStudent(b.student), o = getOrder(b.orderId);
  const pendingPay = b.status === 'pending_payment' && isLive(b);
  return `<article class="card next-class ${b.status === 'awaiting' && admin ? 'highlight' : ''}">
    <div class="date-tile"><span>${fmt(b.date, { month: 'short' }).replace('.', '')}</span><strong>${fmt(b.date, { day: '2-digit' })}</strong></div>
    <div class="class-info">${statusBadge(b)}
      <h3>${admin ? esc(st.name) + ' · ' : 'Aula de surf · '}${esc(p.short)}</h3>
      <div class="class-meta"><span>${icon('clock')}${b.time} – ${addHour(b.time)}</span><span>${icon(b.people > 1 ? 'users' : 'user')}${b.people > 1 ? b.people + ' pessoas' : 'Individual'}</span>${o ? `<span>${icon('money')}${o.plan === 'single' ? 'Avulsa' : PLANS[o.plan].label}${admin ? ' · ' + (remaining(o) ? 'falta ' + money(remaining(o)) : 'quitado') : ''}</span>` : ''}${admin && getBoard(b.board) ? `<span>${icon('board')}${esc(getBoard(b.board).name)}</span>` : ''}</div>
    </div>
    ${pendingPay && !admin ? btn('Pagar sinal', 'pay:' + b.orderId, '', 'lock') : btn(admin ? 'Abrir' : 'Detalhes', (admin ? 'admin-booking:' : 'booking:') + b.id, 'secondary', 'arrow')}
  </article>`;
}
function emptyState(ic, h, p, action = '') { return `<div class="card empty">${icon(ic)}<h3>${h}</h3><p>${p}</p>${action}</div>`; }

/* =========================================================================
   Aluno
   ========================================================================= */
function home() {
  const mine = state.bookings.filter(b => b.student === me().id);
  const next = mine.filter(b => (isLive(b)) && !isPastSlot(b.date, b.time)).sort(byTime)[0];
  const done = mine.filter(b => b.status === 'done').length, packs = activePackages(me().id);
  const lastTip = me().shared.at(-1);
  return `<div class="greeting"><div><h1>Bora pro mar, ${esc(me().name.split(' ')[0])}? <span style="color:var(--orange)">☀</span></h1><p>Aulas com ${esc(S().instructor)} em Jaguaribe e no Farol da Barra.</p></div><div class="date-label">${icon('calendar')}${fmt(today(), { day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
  <div class="home-grid"><div>
    <section class="hero"><img src="surf.jpg" alt="Surfista em uma onda azul sob a luz do sol"><div class="hero-copy"><div class="eyebrow"><span class="dot"></span> AULAS DE 1 HORA · PRANCHA INCLUSA</div><h2>Seu próximo<br>encontro com o <em>mar.</em></h2><p>Reserve com 50% de sinal via Pix ou cartão.</p>${btn('Agendar minha aula', 'nav:book', '', 'arrow')}</div></section>
    <div class="section-head"><h2>Sua próxima sessão</h2><button type="button" class="text-btn" data-action="nav:lessons">Ver minhas aulas ${icon('arrow')}</button></div>
    ${next ? lessonCard(next) : emptyState('wave', 'Seu próximo mergulho na rotina.', 'Escolha uma praia, um horário e encontre a gente no mar.', btn('Encontrar uma aula', 'nav:book', '', 'arrow'))}
    ${lastTip ? `<div class="section-head"><h2>Dica do instrutor</h2></div><div class="card tip">${icon('leaf')}<div><p>“${esc(lastTip.text)}”</p><small>${esc(S().instructor)} · ${fmt(lastTip.date)}</small></div></div>` : ''}
    <div class="section-head"><h2>Onde a gente surfa</h2><button type="button" class="text-btn" data-action="nav:places">Valores e locais ${icon('arrow')}</button></div>
    <div class="places-grid">${state.places.map(p => placeCard(p)).join('')}</div>
  </div>
  <aside class="home-aside">
    ${boardCard(getBoard(next?.board) || null, { student: true })}
    <section class="card progress-card"><div class="progress-top"><span>${icon('leaf')}</span><div><h3>Cada onda conta.</h3><p>${packs.length ? 'Seus créditos de pacote' : 'Seu caminho no surf'}</p></div></div>
      ${packs.length ? packs.map(o => `<div class="progress-line"><i style="width:${creditsUsed(o) / PLANS[o.plan].lessons * 100}%"></i></div><div class="progress-caption"><span><strong>${creditsLeft(o)}</strong> restantes de ${PLANS[o.plan].lessons} · ${esc(placeName(o.place))}</span><span>até ${fmt(o.expiresAt, { day: '2-digit', month: '2-digit' })}</span></div>`).join('') : `<div class="progress-line"><i style="width:${Math.min(100, done * 10)}%"></i></div><div class="progress-caption"><span><strong>${done}</strong> aulas realizadas</span><span>${esc(me().level)}</span></div>`}
    </section>
    <div class="quote">“A gente aprende a surfar.<br>E o mar ensina o resto.”<small>THE OUTSIDE WAY OF LIFE</small></div>
  </aside></div>`;
}

function places() {
  return `<div class="page-content">${title('Encontre a sua praia.', 'Dois picos em Salvador, dois formatos de aula.')}
  <div class="places-grid">${state.places.map(p => placeCard(p)).join('')}</div>
  <div class="price-grid spacer">${state.places.map(priceTable).join('')}</div>
  ${policies()}</div>`;
}
function priceTable(p) {
  return `<section class="card"><div class="row between"><h3>${esc(p.name)}</h3><span class="badge orange">${esc(p.modality).toUpperCase()}</span></div><p class="muted" style="font-size:12px;margin:6px 0 10px">${esc(p.description)}</p>
    ${Object.entries(PLANS).map(([k, plan]) => detail(plan.label + (plan.validity ? ` <small class="muted">· válido ${plan.validity} dias</small>` : ''), money(p.prices[k]))).join('')}
    <p class="legal-note spacer">Aulas às segundas, quartas, quintas, sextas, sábados e domingos. ${p.schedule === 'tide' ? 'Horários definidos pela maré (manhã ou tarde).' : 'Horários das 6h às 12h.'}</p></section>`;
}
function policies() {
  return `<div class="hint policies"><strong>Como funciona</strong><br>• O agendamento é confirmado mediante pagamento de ${S().depositPct}% do valor da aula ou do pacote (Pix ou cartão).<br>• A prancha é fornecida pela escola.<br>• Em caso de imprevisto, a aula pode ser remarcada <strong>uma vez</strong>.<br>• Pix: ${esc(phoneLabel(S().phone))} · ${esc(S().pixName)}</div>`;
}

function book() {
  const rb = reschedule && getBooking(reschedule);
  if (rb) { bk.place = rb.place; bk.people = rb.people; }
  const p = bk.place && getPlace(bk.place), packs = p ? activePackages(me().id, p.id) : [];
  if (bk.plan === 'credit' && !packs.some(o => o.id === bk.orderId)) { bk.plan = 'single'; bk.orderId = null; }
  if (bk.plan !== 'single') bk.people = rb ? rb.people : 1;
  const slots = p && bk.date ? slotsFor(p.id, bk.date, rb?.id) : [];
  const unit = p ? p.prices.single : 0;
  const total = !p ? 0 : bk.plan === 'credit' ? 0 : bk.plan === 'single' ? unit * bk.people : p.prices[bk.plan];
  const dep = Math.round(total * S().depositPct) / 100;
  const days = Array.from({ length: 14 }, (_, i) => addDays(bk.start, i));
  const tide = p?.schedule === 'tide' && bk.date ? tideFor(bk.date) : null;
  const ready = p && bk.date && bk.time;
  return `<div class="page-content">${title(rb ? 'Uma nova data, a mesma vontade.' : 'Reserve seu momento no mar.', rb ? 'Você pode remarcar esta aula uma única vez.' : 'Escolha a praia, o plano e o horário. O sinal confirma sua vaga.')}
  ${rb ? `<div class="notice">${icon('info')}<p>Remarcando a aula de ${fmtShort(rb.date)} às ${rb.time} em ${esc(placeName(rb.place))}. Esta é a sua única remarcação.</p><button type="button" class="text-btn" data-action="stop-reschedule">Desistir</button></div>` : ''}
  <div class="booking-layout"><div>
    <section class="card step"><h3><b>1</b> Onde vamos surfar?</h3>
      <div class="choice-grid">${state.places.map(pl => `<button type="button" class="choice ${bk.place === pl.id ? 'active' : ''}" data-action="bk-place:${pl.id}" ${rb ? 'disabled' : ''}><img src="${esc(pl.image)}" alt=""><span><strong>${esc(pl.name)}</strong><small>${esc(pl.modality)} · ${pl.schedule === 'tide' ? 'conforme a maré' : '6h às 12h'}</small><em>${money(pl.prices.single)} / aula</em></span></button>`).join('')}</div>
    </section>
    ${p && !rb ? `<section class="card step"><h3><b>2</b> Escolha seu plano</h3>
      <div class="plan-grid">
        ${packs.map(o => `<button type="button" class="plan ${bk.plan === 'credit' && bk.orderId === o.id ? 'active' : ''}" data-action="bk-credit:${o.id}"><span class="badge">USAR CRÉDITO</span><strong>${PLANS[o.plan].label}</strong><small>${creditsLeft(o)} aula(s) restantes · até ${fmt(o.expiresAt, { day: '2-digit', month: '2-digit' })}</small><em>Sem custo</em></button>`).join('')}
        ${Object.entries(PLANS).map(([k, plan]) => `<button type="button" class="plan ${bk.plan === k ? 'active' : ''}" data-action="bk-plan:${k}">${k === 'pack10' ? '<span class="badge orange">MELHOR VALOR</span>' : ''}<strong>${plan.label}</strong><small>${plan.validity ? `${money(p.prices[k] / plan.lessons)} por aula · válido ${plan.validity} dias` : '1 hora de aula · prancha inclusa'}</small><em>${money(p.prices[k])}</em></button>`).join('')}
      </div>
      ${p.capacity > 1 && bk.plan === 'single' ? `<div class="people"><span><strong>Quantas pessoas?</strong><small>No Farol da Barra a aula pode ser em dupla. Valor por pessoa.</small></span><div class="seg">${[1, 2].map(n => `<button type="button" class="${bk.people === n ? 'active' : ''}" data-action="bk-people:${n}">${n === 1 ? 'Só eu' : 'Em dupla'}</button>`).join('')}</div></div>${bk.people === 2 ? `<div class="field"><label for="bk-companion">Nome de quem vai com você</label><input id="bk-companion" maxlength="80" value="${esc(bk.companion)}" placeholder="Nome completo"></div>` : ''}` : p.capacity > 1 ? '<p class="legal-note">Pacotes são individuais. Para aula em dupla, escolha a aula avulsa.</p>' : ''}
    </section>` : ''}
    ${p ? `<section class="card step"><h3><b>${rb ? 2 : 3}</b> Data e horário</h3>
      <div class="date-navigation"><strong style="font-size:12px">${fmt(bk.start, { month: 'long', year: 'numeric' })}</strong><div class="row"><button type="button" class="icon-btn" data-action="bk-week:-7" aria-label="Dias anteriores" ${bk.start <= today() ? 'disabled' : ''}>${icon('left')}</button><button type="button" class="icon-btn" data-action="bk-week:7" aria-label="Próximos dias">${icon('chevron')}</button></div></div>
      <div class="dates scroll">${days.map(d => { const open = d >= today() && isClassDay(p.id, d) && !dayBlock(p.id, d) && slotsFor(p.id, d, rb?.id).some(openForStudents); return `<button type="button" class="day ${d === bk.date ? 'active' : ''}" data-action="bk-date:${d}" ${open ? '' : 'disabled'}><small>${fmt(d, { weekday: 'short' }).replace('.', '')}</small><strong>${fmt(d, { day: '2-digit' })}</strong>${open ? '<i></i>' : ''}</button>`; }).join('')}</div>
      ${tide ? `<div class="tide-note">${icon('tide')}<span>Maré ${tide.estimated ? 'estimada' : tide.source === 'previsão' ? 'pela previsão' : 'definida pelo instrutor'} · aulas pela <strong>${tide.period}</strong>${tide.low ? ` · maré baixa ~${tide.low}` : ''}</span></div>` : ''}
      ${bk.date ? `<div class="slot-grid">${slots.length ? slots.map(s => { const mine = state.bookings.some(x => x.id !== rb?.id && x.student === me().id && isLive(x) && x.date === s.date && x.time === s.time), ok = openForStudents(s) && s.free >= bk.people && !mine; return `<button type="button" class="slot-btn ${bk.time === s.time ? 'active' : ''}" data-action="bk-time:${s.time}" ${ok ? '' : 'disabled'}><strong>${s.time}</strong><small>${mine ? 'Você já tem aula' : s.block ? 'Indisponível' : s.soon ? 'Encerrado' : s.free <= 0 ? 'Lotado' : s.free < bk.people ? 'Só 1 vaga' : p.capacity > 1 ? `${s.free} de ${p.capacity} vagas` : 'Disponível'}</small>${slotForecast(p.id, s.date, s.time)}</button>`; }).join('') : '<p class="muted">Sem horários neste dia.</p>'}</div>${dayForecastCard(p.id, bk.date)}${bk.time ? conditionsCard(p.id, bk.date, bk.time) : slots.length ? '<p class="legal-note spacer">Toque em um horário para ver a previsão do mar nessa hora.</p>' : ''}` : '<p class="muted spacer" style="font-size:12px">Os dias com bolinha têm horários livres.</p>'}
    </section>` : ''}
  </div>
  <aside class="booking-side"><div class="card summary">
    <div class="eyebrow">RESUMO</div>
    ${p ? `<div class="place-img" style="border-radius:10px;margin:12px 0"><img src="${esc(p.image)}" alt=""></div><h3>${esc(p.name)}</h3>` : '<h3 style="margin-top:10px">Escolha uma praia para começar</h3>'}
    ${p ? detail('Plano', rb ? 'Remarcação' : bk.plan === 'credit' ? 'Crédito do pacote' : PLANS[bk.plan].label) : ''}
    ${p && bk.people > 1 ? detail('Pessoas', bk.people) : ''}
    ${bk.date ? detail('Data', fmt(bk.date, { weekday: 'short', day: 'numeric', month: 'short' })) : ''}
    ${bk.time ? detail('Horário', `${bk.time} – ${addHour(bk.time)}`) : ''}
    ${bk.time && Forecast.peek(p.id) ? (r => r ? detail('Mar previsto', ratePill(r)) : '')(Forecast.rate(p.id, Forecast.hourAt(Forecast.peek(p.id), bk.date, +bk.time.slice(0, 2)))) : ''}
    ${p && !rb && bk.plan !== 'credit' ? `${detail('Total', money(total))}<div class="detail-row total"><span>Sinal agora (${S().depositPct}%)</span><strong>${money(dep)}</strong></div><p class="legal-note">Restante de ${money(total - dep)} pago até o dia da aula.</p>` : ''}
    <button type="button" class="btn full spacer" data-action="bk-submit" ${ready ? '' : 'disabled'}>${rb ? 'Confirmar remarcação' : bk.plan === 'credit' ? 'Agendar com crédito' : 'Continuar para pagamento'} ${icon(rb || bk.plan === 'credit' ? 'check' : 'lock')}</button>
    <p class="legal-note spacer">${icon('lock')} Pagamento seguro · Pix ou cartão</p>
  </div>${policies()}</aside></div></div>`;
}

function lessons() {
  const all = state.bookings.filter(b => b.student === me().id && b.status !== 'expired');
  const up = all.filter(b => (isLive(b)) && !isPastSlot(b.date, b.time)).sort(byTime);
  const hist = all.filter(b => !up.includes(b)).sort(byTime).reverse();
  const list = tab === 'upcoming' ? up : hist;
  return `<div class="page-content">${title('Suas histórias com o mar.', 'Acompanhe pagamentos, confirmações e a prancha de cada aula.', btn('Agendar aula', 'nav:book', '', 'plus'))}
  <div class="tabs"><button type="button" data-action="tab:upcoming" class="${tab === 'upcoming' ? 'active' : ''}">Próximas (${up.length})</button><button type="button" data-action="tab:history" class="${tab === 'history' ? 'active' : ''}">Histórico (${hist.length})</button></div>
  <div class="list-stack">${list.length ? list.map(b => lessonCard(b)).join('') : emptyState('wave', 'Nenhuma aula por aqui ainda.', 'Sua próxima sessão está a poucos toques.', btn('Agendar aula', 'nav:book'))}</div></div>`;
}

function boardGallery() {
  const avail = state.boards.filter(b => b.available && b.condition === 'ok');
  return `<div class="page-content">${title('O quiver da escola.', 'A prancha é fornecida pela escola. O instrutor escolhe a ideal para o seu nível e para o mar do dia.')}<div class="board-gallery">${avail.map(b => boardCard(b)).join('') || emptyState('board', 'Quiver em manutenção.', 'Em breve as pranchas aparecem aqui.')}</div></div>`;
}

function profile() {
  const s = me(), orders = state.orders.filter(o => o.student === s.id && o.status !== 'expired').sort((a, b) => b.createdAt - a.createdAt);
  return `<div class="page-content">${title('Seu surf. Sua história.', 'Seus dados, pacotes e orientações do instrutor.', btn('Preferências', 'settings', 'secondary', 'settings'))}
  <div class="profile-layout"><div>
    <section class="card"><div class="profile-head"><div class="avatar big">${initials(s.name)}</div><div><h2>${esc(s.name)}</h2><p>${esc(s.email)}</p><span class="badge orange">${esc(s.level)}</span></div></div>
      ${detail('Contato', esc(s.phone) || 'Não informado')}${detail('Aulas realizadas', state.bookings.filter(b => b.student === s.id && b.status === 'done').length)}
      <div class="spacer">${btn('Editar meus dados', 'edit-student:' + s.id, 'secondary', 'edit')}</div></section>
    <section class="card spacer"><h3>Pacotes e pagamentos</h3>${orders.map(o => `<div class="order-row"><div><strong>${PLANS[o.plan].label} · ${esc(placeName(o.place))}</strong><small>${o.plan !== 'single' ? `${creditsLeft(o)} de ${PLANS[o.plan].lessons} aulas restantes · válido até ${fmt(o.expiresAt)}` : 'Aula avulsa'} · pedido ${esc(o.code)}</small></div><div class="right"><strong>${money(o.paid)}<small> de ${money(o.total)}</small></strong>${o.status === 'refunded' ? '<span class="badge gray">ESTORNADO</span>' : remaining(o) > 0 && o.paid >= deposit(o) ? `<button type="button" class="text-btn" data-action="pay:${o.id}">Pagar restante ${icon('arrow')}</button>` : remaining(o) > 0 ? `<button type="button" class="text-btn" data-action="pay:${o.id}">Pagar sinal ${icon('arrow')}</button>` : '<span class="badge">QUITADO</span>'}</div></div>`).join('') || '<p class="muted spacer">Nenhum pagamento ainda.</p>'}</section>
    <section class="card spacer"><h3>Orientações do instrutor</h3>${s.shared.slice().reverse().map(n => `<div class="note"><small>${esc(S().instructor)} · ${fmt(n.date)}</small><p>${esc(n.text)}</p></div>`).join('') || '<p class="muted spacer">As próximas orientações vão aparecer aqui.</p>'}</section>
  </div>${boardCard(getBoard(s.board), { eyebrow: 'SUA PRANCHA HABITUAL' })}</div></div>`;
}

/* =========================================================================
   Previsão do mar (ondas, vento e maré)
   ========================================================================= */
let fcSpot = 'jaguaribe', fcDate = today();
const fcLoading = {};
function ensureForecast(spot) {
  if (typeof Forecast === 'undefined' || Forecast.peek(spot) || fcLoading[spot]) return;
  fcLoading[spot] = true;
  Forecast.load(spot).finally(() => {
    fcLoading[spot] = false;
    if (['book', 'forecast', 'agenda'].includes(page)) { const y = window.scrollY; render(); window.scrollTo(0, y); }
  });
}
const dirArrow = (deg, cls = '') => deg == null ? '' : `<svg class="dir ${cls}" viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(${Math.round(deg)}deg)"><path d="M12 4v16m-5-5 5 5 5-5"/></svg>`;
const hh = h => String(h).padStart(2, '0') + 'h';
const m1 = v => v == null ? '—' : (Math.round(v * 10) / 10).toLocaleString('pt-BR', { minimumFractionDigits: 1 });
const range = (vals, f) => { const a = f(Math.min(...vals)), b = f(Math.max(...vals)); return a === b ? String(a) : `${a}–${b}`; };
const ratePill = r => r ? `<span class="rate ${r.cls}"><i></i>${r.label}</span>` : '';
const fcSource = data => `<p class="legal-note fc-source">${icon('info')} ${data?.simulated ? 'Sem conexão com o serviço de previsão: exibindo uma <strong>simulação</strong>.' : `Dados Open-Meteo (modelos de ondas e vento) · atualizado ${data ? new Date(data.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}. Maré modelada: confira a tábua da Marinha.`}</p>`;

// Horários do Farol pela maré: usa a maré baixa da previsão quando disponível.
function forecastTide(date) {
  const data = typeof Forecast !== 'undefined' && Forecast.peek('farol');
  if (!data || data.simulated) return null;
  const low = Forecast.tides(data, date).find(t => t.type === 'baixa' && t.minutes >= 6 * 60 && t.minutes <= 16 * 60);
  if (!low) return null;
  const start = Math.min(14, Math.max(6, Math.round(low.minutes / 60) - 1));
  return { period: start < 12 ? 'manhã' : 'tarde', hours: [0, 1, 2].map(i => String(start + i).padStart(2, '0') + ':00'), low: low.time, estimated: false, source: 'previsão' };
}

// Cartão de condições para um horário específico (usado no agendamento).
function conditionsCard(spot, date, time, { compact = false } = {}) {
  const data = Forecast.peek(spot), hour = +time.slice(0, 2);
  if (!data) return `<div class="fc-card loading"><div class="spinner sm"></div><p>Carregando a previsão do mar…</p></div>`;
  if (date > Forecast.lastDate(data)) return `<div class="fc-card empty-fc">${icon('wave')}<p>A previsão do mar para ${fmtShort(date)} fica disponível até 7 dias antes da aula.</p></div>`;
  const h = Forecast.hourAt(data, date, hour), r = Forecast.rate(spot, h);
  if (!h) return '';
  const trend = Forecast.tideTrend(data, date, hour), pct = Forecast.tidePct(data, date, hour);
  const kind = Forecast.windKind(spot, h.windDir);
  return `<div class="fc-card">
    <div class="fc-head"><div><div class="eyebrow">PREVISÃO DO MAR</div><h3>Na sua aula · ${hh(hour)} às ${hh(hour + 1)}</h3></div>${ratePill(r)}</div>
    <div class="fc-grid">
      <div><small>ONDAS</small><strong>${m1(h.wave)} m</strong><span>${dirArrow(h.dir)}${Forecast.compass(h.dir)} · ${Math.round(h.period)} s</span></div>
      <div><small>SWELL</small><strong>${m1(h.swell)} m</strong><span>${dirArrow(h.swellDir)}${Forecast.compass(h.swellDir)} · ${Math.round(h.swellPeriod)} s</span></div>
      <div><small>VENTO</small><strong>${h.wind == null ? '—' : Math.round(h.wind) + ' km/h'}</strong><span>${dirArrow(h.windDir)}${h.windDir == null ? '' : Forecast.compass(h.windDir)}${kind ? ` · <b class="wk ${kind}">${kind}</b>` : ''}</span></div>
      <div><small>MARÉ</small><strong>${trend ? trend[0].toUpperCase() + trend.slice(1) : '—'}</strong><span class="tide-bar"><i style="width:${pct ?? 0}%"></i></span></div>
    </div>
    ${compact ? '' : `<p class="fc-advice">${icon('leaf')} ${esc(Forecast.advice(spot, h))}</p>
    <div class="row between wrap"><button type="button" class="text-btn" data-action="fc-open:${spot}|${date}">Ver hora a hora ${icon('arrow')}</button>${h.temp != null ? `<small class="muted">${Math.round(h.temp)}°C no ar</small>` : ''}</div>`}
  </div>`;
}

// Previsão do dia escolhido no agendamento: melhor horário, ondas, vento e maré.
function dayForecastCard(spot, date) {
  const data = Forecast.peek(spot);
  if (!data) return `<div class="fc-card loading"><div class="spinner sm"></div><p>Carregando a previsão do mar…</p></div>`;
  if (date > Forecast.lastDate(data)) return `<div class="fc-card empty-fc">${icon('wave')}<p>A previsão do mar para ${fmtShort(date)} fica disponível até 7 dias antes da aula.</p></div>`;
  const p = getPlace(spot), lessonHours = slotsFor(spot, date).map(s => +s.time.slice(0, 2));
  const hs = Forecast.dayHours(data, date).filter(h => lessonHours.includes(h.hour));
  if (!hs.length) return '';
  const rated = hs.map(h => ({ h, r: Forecast.rate(spot, h) })), best = rated.slice().sort((a, b) => b.r.score - a.r.score)[0];
  const waves = hs.map(h => h.wave), winds = hs.map(h => h.wind).filter(v => v != null);
  return `<div class="fc-card fc-day-card">
    <div class="fc-head"><div><div class="eyebrow">PREVISÃO DO MAR · ${esc(p.short).toUpperCase()}</div><h3>${fmt(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h3></div>${ratePill(best.r)}</div>
    <div class="fc-grid">
      <div><small>MELHOR HORÁRIO</small><strong>${hh(best.h.hour)}</strong><span>${best.r.label}</span></div>
      <div><small>ONDAS NAS AULAS</small><strong>${range(waves, m1)} m</strong><span>${dirArrow(best.h.dir)}${Forecast.compass(best.h.dir)} · ${Math.round(best.h.period)} s</span></div>
      <div><small>VENTO</small><strong>${winds.length ? range(winds, Math.round) : '—'} km/h</strong><span>${dirArrow(best.h.windDir)}${best.h.windDir == null ? '' : Forecast.compass(best.h.windDir)}</span></div>
      <div><small>MARÉS</small><strong class="fc-tide-mini">${Forecast.tides(data, date).map(t => `${t.type === 'alta' ? '▲' : '▼'} ${t.time}`).join('<br>') || '—'}</strong></div>
    </div>
    ${tideChart(spot, date, data)}
  </div>`;
}

function tideChart(spot, date, data) {
  const hs = Forecast.dayHours(data, date).filter(h => h.tide != null);
  if (hs.length < 6) return '';
  const W = 640, H = 165, P = 18, lo = Math.min(...hs.map(h => h.tide)) - 0.15, hi = Math.max(...hs.map(h => h.tide)) + 0.15;
  const x = hour => P + hour / 23 * (W - 2 * P), y = v => H - 44 - (v - lo) / (hi - lo) * (H - 70);
  const pts = hs.map(h => [x(h.hour), y(h.tide)]);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], cx = (x0 + x1) / 2; d += ` C${cx} ${y0} ${cx} ${y1} ${x1} ${y1}`; }
  const lessons = (getPlace(spot).schedule === 'tide' ? tideFor(date).hours : getPlace(spot).hours).map(t => +t.slice(0, 2));
  const now = date === today() ? new Date(Date.now() - 3 * 3600e3) : null, nowH = now ? now.getUTCHours() + now.getUTCMinutes() / 60 : null;
  const extremes = Forecast.tides(data, date);
  return `<svg class="tide-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico da maré em ${fmt(date)}">
    <defs><linearGradient id="tideFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#1f8f8a" stop-opacity=".35"/><stop offset="1" stop-color="#1f8f8a" stop-opacity=".02"/></linearGradient></defs>
    ${lessons.map(hr => `<rect x="${x(hr)}" y="8" width="${x(hr + 1) - x(hr)}" height="${H - 34}" class="lesson-band"/>`).join('')}
    <path d="${d} L${pts.at(-1)[0]} ${H - 26} L${pts[0][0]} ${H - 26} Z" fill="url(#tideFill)"/>
    <path d="${d}" class="tide-line"/>
    ${extremes.map(t => { const hx = x(t.minutes / 60), hy = y(t.height); return `<circle cx="${hx}" cy="${hy}" r="4" class="tide-pt ${t.type}"/><text x="${hx}" y="${t.type === 'alta' ? hy - 10 : hy + 18}" text-anchor="middle" class="tide-lbl">${t.time}</text>`; }).join('')}
    ${nowH != null ? `<line x1="${x(nowH)}" x2="${x(nowH)}" y1="6" y2="${H - 26}" class="now-line"/><text x="${x(nowH)}" y="${H - 30}" text-anchor="middle" class="now-lbl">agora</text>` : ''}
    ${[0, 3, 6, 9, 12, 15, 18, 21].map(hr => `<text x="${x(hr)}" y="${H - 8}" text-anchor="middle" class="axis">${hh(hr)}</text>`).join('')}
  </svg>`;
}

function forecastPage() {
  const data = Forecast.peek(fcSpot), p = getPlace(fcSpot);
  state.places.forEach(pl => ensureForecast(pl.id));
  const days = data ? [...new Set(data.hours.map(h => h.date))].filter(d => d >= today()) : [];
  if (days.length && !days.includes(fcDate)) fcDate = days[0];
  const lessonHours = d => (p.schedule === 'tide' ? tideFor(d).hours : p.hours).map(t => +t.slice(0, 2));
  const dayBest = d => {
    if (!isClassDay(p.id, d)) return null;
    return lessonHours(d).map(hr => ({ hr, r: Forecast.rate(fcSpot, Forecast.hourAt(data, d, hr)) })).filter(x => x.r).sort((a, b) => b.r.score - a.r.score)[0] || null;
  };
  const hours = data ? Forecast.dayHours(data, fcDate).filter(h => h.hour >= 5 && h.hour <= 18) : [];
  const best = data ? dayBest(fcDate) : null, lessonsToday = lessonHours(fcDate);
  const waves = hours.map(h => h.wave), sun = data?.sun?.[fcDate];
  return `<div class="page-content">${title('Previsão do mar.', 'Ondas, vento e maré hora a hora nos picos das aulas.', btn('Atualizar', 'fc-refresh', 'secondary', 'refresh'))}
  <div class="row between wrap fc-top"><div class="seg">${state.places.map(pl => `<button type="button" class="${fcSpot === pl.id ? 'active' : ''}" data-action="fc-spot:${pl.id}">${esc(pl.short)}</button>`).join('')}</div>${data ? '' : '<span class="muted small"><span class="spinner sm"></span> Carregando…</span>'}</div>
  ${data ? `<div class="fc-days">${days.map(d => { const b = dayBest(d), dh = Forecast.dayHours(data, d), max = Math.max(...dh.map(h => h.wave)); return `<button type="button" class="fc-day ${d === fcDate ? 'active' : ''}" data-action="fc-date:${d}"><small>${fmt(d, { weekday: 'short' }).replace('.', '')} ${fmt(d, { day: '2-digit' })}</small><strong>${m1(max)}<em>m</em></strong>${b ? `<span class="rate-bar ${b.r.cls}"></span><small>${b.r.label}</small>` : '<span class="rate-bar none"></span><small>sem aula</small>'}</button>`; }).join('')}</div>
  <div class="fc-layout"><div>
    <section class="card fc-summary">
      <div class="row between wrap"><div><div class="eyebrow">${esc(p.name).toUpperCase()}</div><h2>${fmt(fcDate, { weekday: 'long', day: 'numeric', month: 'long' })}</h2></div>${best ? ratePill(best.r) : ''}</div>
      <div class="fc-stats">
        <div><small>ONDAS</small><strong>${m1(Math.min(...waves))}–${m1(Math.max(...waves))} m</strong></div>
        <div><small>MELHOR HORÁRIO DE AULA</small><strong>${best ? `${hh(best.hr)} · ${best.r.label}` : 'Sem aula neste dia'}</strong></div>
        ${sun ? `<div><small>SOL</small><strong>${sun.rise} – ${sun.set}</strong></div>` : ''}
        <div><small>MARÉS</small><strong class="fc-tide-list">${Forecast.tides(data, fcDate).map(t => `${t.type === 'alta' ? '▲' : '▼'} ${t.time}`).join(' · ') || '—'}</strong></div>
      </div>
      ${tideChart(fcSpot, fcDate, data)}
      <p class="legal-note"><span class="legend-band"></span> Horários de aula ${p.schedule === 'tide' ? 'definidos pela maré' : 'em ' + esc(p.short)}</p>
    </section>
    <section class="card fc-table spacer"><div class="fc-row head"><span>Hora</span><span>Condição</span><span>Ondas</span><span>Swell</span><span>Vento</span><span>Maré</span><span></span></div>
      ${hours.map(h => { const r = Forecast.rate(fcSpot, h), lesson = lessonsToday.includes(h.hour) && isClassDay(p.id, fcDate), kind = Forecast.windKind(fcSpot, h.windDir), trend = Forecast.tideTrend(data, fcDate, h.hour), slot = lesson && slotsFor(p.id, fcDate).find(s => +s.time.slice(0, 2) === h.hour); return `<div class="fc-row ${lesson ? 'lesson' : ''}">
        <span class="hr">${hh(h.hour)}</span><span>${ratePill(r)}</span>
        <span><b>${m1(h.wave)} m</b>${dirArrow(h.dir)}<small>${Math.round(h.period)}s</small></span>
        <span>${m1(h.swell)} m<small>${Math.round(h.swellPeriod)}s ${Forecast.compass(h.swellDir)}</small></span>
        <span>${h.wind == null ? '—' : `<b>${Math.round(h.wind)}</b>`}${dirArrow(h.windDir)}<small class="wk ${kind}">${kind}</small></span>
        <span>${trend === 'enchendo' ? '↗' : trend === 'secando' ? '↘' : '→'} <small>${trend || ''}</small></span>
        <span>${role === 'student' && slot && openForStudents(slot) ? `<button type="button" class="btn small" data-action="fc-book:${p.id}|${fcDate}|${slot.time}">Agendar</button>` : lesson ? '<small class="muted">aula</small>' : ''}</span>
      </div>`; }).join('')}
    </section>
  </div><aside>
    <section class="card"><h3>Como ler</h3>
      <div class="legend"><span class="rate great"><i></i>Excelente</span><span class="rate good"><i></i>Bom</span><span class="rate fair"><i></i>Regular</span><span class="rate poor"><i></i>Difícil</span></div>
      <p class="muted spacer" style="font-size:12px;line-height:1.7">A nota considera o tamanho e o período das ondas e o vento para <strong>aula</strong>: ondas entre 0,5 e 1,3 m e vento <b class="wk terral">terral</b> (da terra para o mar) são o ideal. Vento <b class="wk maral">maral</b> forte deixa o mar mexido.</p>
    </section>
    <section class="card spacer"><h3>Agora nos picos</h3>${state.places.map(pl => { const d = Forecast.peek(pl.id), h = d && Forecast.hourAt(d, today(), Math.min(23, new Date(Date.now() - 3 * 3600e3).getUTCHours())); return `<button type="button" class="now-spot" data-action="fc-spot:${pl.id}"><span><strong>${esc(pl.short)}</strong><small>${h ? `${m1(h.wave)} m · vento ${h.wind == null ? '—' : Math.round(h.wind) + ' km/h'} ${Forecast.windKind(pl.id, h.windDir)}` : 'carregando…'}</small></span>${h ? ratePill(Forecast.rate(pl.id, h)) : ''}</button>`; }).join('')}</section>
    ${role === 'student' ? `<div class="spacer">${btn('Agendar uma aula', 'book-place:' + fcSpot, 'full', 'calendar')}</div>` : ''}
  </aside></div>
  ${fcSource(data)}` : `<div class="card empty"><div class="spinner"></div><h3>Consultando o mar…</h3><p>Buscando ondas, vento e maré.</p></div>`}</div>`;
}

/* ---------- Detalhe da aula (aluno) ---------- */
function bookingDetail(id) {
  const b = getBooking(id), p = getPlace(b.place), o = getOrder(b.orderId), board = getBoard(b.board);
  const canMove = LIVE.includes(b.status) && !isPastSlot(b.date, b.time) && (b.rescheduled || 0) < 1;
  modal('Sua sessão no mar', `<div class="row between">${statusBadge(b)}<small class="muted">Reserva ${esc(b.code)}</small></div>
    <div class="booking-hero">${board ? boardImg(board, 'mini') : ''}<div>${detail('Local', esc(p.name))}${detail('Data', fmt(b.date, { weekday: 'long', day: 'numeric', month: 'long' }))}${detail('Horário', `${b.time} – ${addHour(b.time)}`)}${detail('Formato', b.people > 1 ? `Dupla · com ${esc(o?.companion || 'acompanhante')}` : 'Individual')}${detail('Prancha', board ? `${esc(board.name)} ${esc(board.size)}` : 'Definida pelo instrutor')}</div></div>
    ${o ? `<div class="pay-box">${detail('Pedido', `${PLANS[o.plan].label} · ${esc(o.code)}`)}${detail('Pago', `${money(o.paid)} de ${money(o.total)}`)}${remaining(o) && o.status !== 'refunded' ? detail('Restante', money(remaining(o))) : ''}</div>` : ''}
    ${b.status === 'awaiting' ? `<div class="notice spacer">${icon('clock')}<p>Pagamento recebido! ${esc(S().instructor.split(' ')[0])} vai confirmar sua aula em breve.</p></div>` : ''}
    ${b.reason ? `<div class="notice spacer">${icon('info')}<p>${esc(b.reason)}</p></div>` : ''}
    <div class="hint">${icon('pin')} ${esc(p.meeting)}<br>Leve água, protetor solar e roupa de banho. Chegue 10 minutos antes.</div>
    <div class="modal-actions wrap">
      <a class="btn secondary" href="${whatsapp(S().phone, `Olá ${S().instructor.split(' ')[0]}! Sobre minha aula ${b.code} de ${fmtShort(b.date)} às ${b.time}.`)}" target="_blank" rel="noopener">WhatsApp ${icon('phone')}</a>
      ${b.status === 'pending_payment' && isLive(b) ? btn('Pagar sinal', 'pay:' + o.id, '', 'lock') : ''}
      ${o && remaining(o) > 0 && o.paid >= deposit(o) && LIVE.includes(b.status) ? btn('Pagar restante', 'pay:' + o.id, 'secondary', 'money') : ''}
      ${canMove ? btn('Remarcar (1x)', 'reschedule:' + id, '', 'calendar') : LIVE.includes(b.status) && b.rescheduled ? '<span class="legal-note">Esta aula já foi remarcada uma vez.</span>' : ''}
    </div>`);
}

/* ---------- Criar reserva ---------- */
function slotForecast(spot, date, time) {
  ensureForecast(spot);
  const data = Forecast.peek(spot), h = data && Forecast.hourAt(data, date, +time.slice(0, 2)), r = Forecast.rate(spot, h);
  return h ? `<span class="slot-fc ${r.cls}"><i></i>${m1(h.wave)} m · ${r.label}</span>` : '';
}
function bookingError(placeId, date, time, people, ignore) {
  if (!navigator.onLine) return 'Conecte-se à internet para agendar.';
  const slot = slotsFor(placeId, date, ignore).find(s => s.time === time);
  if (!slot || !openForStudents(slot)) return 'Este horário não está mais disponível. Escolha outro.';
  if (slot.free < people) return 'Não há vagas suficientes neste horário.';
  if (state.bookings.some(b => b.id !== ignore && b.student === me().id && isLive(b) && b.date === date && b.time === time)) return 'Você já tem uma aula neste horário.';
  return null;
}
async function submitBooking() {
  const p = getPlace(bk.place);
  if (!p || !bk.date || !bk.time) return;
  if (reschedule) {
    const b = getBooking(reschedule), err = bookingError(b.place, bk.date, bk.time, b.people, b.id);
    if (err) { toast(err); render(); return; }
    if ((b.rescheduled || 0) >= 1) { toast('Esta aula já foi remarcada uma vez.'); return; }
    const from = `${fmtShort(b.date)} ${b.time}`;
    b.history.push({ at: Date.now(), text: `Remarcada pelo aluno de ${from} para ${fmtShort(bk.date)} ${bk.time}` });
    Object.assign(b, { date: bk.date, time: bk.time, rescheduled: (b.rescheduled || 0) + 1 });
    reschedule = null;
    save(); go('lessons');
    toast('Aula remarcada!');
    notifyAdmin('Aula remarcada', `${me().name} · ${p.short} · de ${from} para ${fmtShort(b.date)} às ${b.time}`, b.id);
    return;
  }
  if (bk.people === 2 && !bk.companion.trim()) { toast('Informe o nome de quem vai com você.'); $('#bk-companion')?.focus(); return; }
  const err = bookingError(p.id, bk.date, bk.time, bk.people);
  if (err) { toast(err); render(); return; }
  const student = me(), board = suggestBoard(student);
  if (bk.plan === 'credit') {
    const o = getOrder(bk.orderId);
    if (!o || creditsLeft(o) <= 0 || o.expiresAt < bk.date) { toast(o && o.expiresAt < bk.date ? `O pacote vale até ${fmt(o.expiresAt)}. Escolha uma data anterior.` : 'Sem créditos disponíveis neste pacote.'); return; }
    const b = { id: uid(), code: shortCode(), orderId: o.id, student: student.id, place: p.id, date: bk.date, time: bk.time, people: 1, status: S().autoConfirm ? 'confirmed' : 'awaiting', board, rescheduled: 0, createdAt: Date.now(), history: [] };
    state.bookings.push(b);
    resetBk(); save(); go('lessons');
    successModal(b);
    notifyAdmin('Novo agendamento · pacote', `${student.name} · ${p.short} · ${fmtShort(b.date)} às ${b.time} · crédito ${creditsUsed(o)}/${PLANS[o.plan].lessons}`, b.id);
    return;
  }
  const total = bk.plan === 'single' ? p.prices.single * bk.people : p.prices[bk.plan];
  const o = { id: uid(), code: shortCode(), student: student.id, place: p.id, plan: bk.plan, people: bk.plan === 'single' ? bk.people : 1, companion: bk.people === 2 ? bk.companion.trim() : '', total, paid: 0, createdAt: Date.now(), expiresAt: PLANS[bk.plan].validity ? addDays(today(), PLANS[bk.plan].validity) : null, status: 'pending' };
  const b = { id: uid(), code: shortCode(), orderId: o.id, student: student.id, place: p.id, date: bk.date, time: bk.time, people: o.people, status: 'pending_payment', holdUntil: Date.now() + S().holdMinutes * 60e3, board, rescheduled: 0, createdAt: Date.now(), history: [] };
  state.orders.push(o); state.bookings.push(b);
  resetBk(); save(); render();
  checkout(o.id);
}
function resetBk() { bk = { place: bk.place, plan: 'single', people: 1, companion: '', date: null, time: null, orderId: null, start: today() }; }
function successModal(b) {
  const confirmed = b.status === 'confirmed';
  modal('Tudo certo. Nos vemos no mar!', `<div class="success"><div class="success-icon">${icon('check')}</div><h3>${confirmed ? 'Aula confirmada!' : 'Pedido enviado ao instrutor'}</h3><p>${fmt(b.date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${b.time}<br>${esc(getPlace(b.place).name)}</p>${!confirmed ? `<div class="hint" style="text-align:left">${icon('bell')} ${esc(S().instructor.split(' ')[0])} recebeu uma notificação e vai confirmar seu horário. Você será avisado aqui no app.</div>` : ''}<div class="modal-actions" style="justify-content:center">${btn('Ver minhas aulas', 'success-lessons', '', 'arrow')}</div></div>`);
}

/* =========================================================================
   Pagamento (gateway simulado)
   ========================================================================= */
function checkout(orderId) {
  const o = getOrder(orderId);
  if (!o) return;
  const dep = deposit(o), firstPayment = o.paid < dep;
  pay = { orderId, amount: firstPayment ? dep - o.paid : remaining(o), method: 'pix', stage: 'form', txid: 'OS' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(), expires: Date.now() + 15 * 60e3, error: '' };
  renderCheckout();
}
function renderCheckout() {
  if (!pay) return;
  const o = getOrder(pay.orderId), p = getPlace(o.place), dep = deposit(o), b = state.bookings.filter(x => x.orderId === o.id).sort(byTime)[0];
  const options = o.paid < dep ? [[dep - o.paid, `Sinal de ${S().depositPct}%`, 'Confirma o agendamento'], [remaining(o), 'Valor total', 'Nada a pagar no dia']] : [[remaining(o), 'Restante', 'Quita o pedido']];
  if (!options.some(([v]) => v === pay.amount)) pay.amount = options[0][0];
  const installments = o.plan === 'single' ? 1 : 3;
  let body = '';
  if (pay.stage === 'processing') body = `<div class="processing"><div class="spinner"></div><h3>Processando pagamento…</h3><p class="muted">Comunicando com o gateway. Não feche esta janela.</p></div>`;
  else if (pay.stage === 'approved') body = `<div class="success"><div class="success-icon">${icon('check')}</div><h3>Pagamento aprovado!</h3><p>${money(pay.paidAmount)} · ${pay.method === 'pix' ? 'Pix' : 'Cartão'} · ${esc(pay.txid)}</p>${b && b.status === 'awaiting' ? `<div class="hint" style="text-align:left">${icon('bell')} Seu horário está reservado. ${esc(S().instructor.split(' ')[0])} recebeu uma notificação e vai confirmar a aula.</div>` : b && b.status === 'confirmed' ? '<div class="hint">Aula confirmada! Nos vemos no mar.</div>' : ''}<div class="modal-actions" style="justify-content:center">${btn('Ver minhas aulas', 'success-lessons', '', 'arrow')}</div></div>`;
  else {
    const pixCode = Pix.payload({ key: S().pixKey, name: S().pixName, city: S().city, amount: pay.amount, txid: pay.txid });
    body = `<div class="checkout-summary"><div><strong>${PLANS[o.plan].label}${o.people > 1 ? ' · 2 pessoas' : ''}</strong><small>${esc(p.name)}${b ? ` · ${fmtShort(b.date)} às ${b.time}` : ''} · pedido ${esc(o.code)}</small></div><strong>${money(o.total)}</strong></div>
    ${b && b.status === 'pending_payment' ? `<p class="legal-note hold">${icon('clock')} Horário reservado por <span data-countdown="${b.holdUntil}">--:--</span> aguardando o pagamento.</p>` : ''}
    <div class="amount-options">${options.map(([v, l, s]) => `<label class="amount ${pay.amount === v ? 'active' : ''}"><input type="radio" name="pay-amount" value="${v}" ${pay.amount === v ? 'checked' : ''}><span><strong>${l}</strong><small>${s}</small></span><em>${money(v)}</em></label>`).join('')}</div>
    <div class="pay-tabs" role="tablist"><button type="button" role="tab" class="${pay.method === 'pix' ? 'active' : ''}" data-action="pay-method:pix">${icon('pix')} Pix</button><button type="button" role="tab" class="${pay.method === 'card' ? 'active' : ''}" data-action="pay-method:card">${icon('card')} Cartão</button></div>
    ${pay.method === 'pix' ? `<div class="pix-area">
        <div class="qr-box">${Pix.qrSvg(pixCode)}</div>
        <div class="pix-info"><span class="pulse-dot"></span><strong>Aguardando pagamento</strong><small>Expira em <span data-countdown="${pay.expires}">15:00</span></small>
          ${detail('Valor', money(pay.amount))}${detail('Recebedor', esc(S().pixName))}${detail('Chave (celular)', esc(phoneLabel(S().phone)))}
        </div>
      </div>
      <div class="field"><label for="pix-code">Pix copia e cola</label><div class="copy-row"><input id="pix-code" readonly value="${esc(pixCode)}">${btn('Copiar', 'copy-pix', 'secondary', 'copy')}</div></div>
      <div class="sandbox">${icon('info')}<p><strong>Ambiente de simulação.</strong> Em produção o gateway confirma o Pix automaticamente por webhook. Aqui, simule a confirmação:</p></div>
      <div class="modal-actions">${btn('Simular Pix recebido', 'pix-paid', '', 'check')}</div>`
    : `<form data-form="card" class="card-form" novalidate>
        <div class="card-preview"><span class="brand-tag" id="card-brand">CARTÃO</span><div class="chip"></div><div id="card-num-preview">•••• •••• •••• ••••</div><small id="card-name-preview">NOME NO CARTÃO</small></div>
        <div class="field"><label for="cc-number">Número do cartão</label><input id="cc-number" name="number" inputmode="numeric" autocomplete="cc-number" placeholder="0000 0000 0000 0000" maxlength="23" required></div>
        <div class="field"><label for="cc-name">Nome impresso no cartão</label><input id="cc-name" name="name" autocomplete="cc-name" maxlength="60" required></div>
        <div class="fields three"><div class="field"><label for="cc-exp">Validade</label><input id="cc-exp" name="exp" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/AA" maxlength="5" required></div><div class="field"><label for="cc-cvv">CVV</label><input id="cc-cvv" name="cvv" inputmode="numeric" autocomplete="cc-csc" placeholder="123" maxlength="4" required></div>
        <div class="field"><label for="cc-inst">Parcelas</label><select id="cc-inst" name="installments">${Array.from({ length: installments }, (_, i) => `<option value="${i + 1}">${i + 1}x de ${money(pay.amount / (i + 1))}</option>`).join('')}</select></div></div>
        ${pay.error ? `<div class="notice">${icon('info')}<p>${esc(pay.error)}</p></div>` : ''}
        <div class="sandbox">${icon('info')}<p><strong>Simulação.</strong> Use 4111 1111 1111 1111 (aprovado) ou 4000 0000 0000 0002 (recusado), qualquer validade futura e CVV.</p></div>
        <div class="modal-actions"><button type="submit" class="btn">Pagar ${money(pay.amount)} ${icon('lock')}</button></div>
      </form>`}
    <p class="legal-note secure">${icon('lock')} Pagamento processado com criptografia. ${esc(S().school)} não armazena os dados do seu cartão.</p>`;
  }
  modal(pay.stage === 'approved' ? 'Pagamento confirmado' : 'Pagamento seguro', body, 'checkout');
  startPixTimer();
}
let pixTimer = null;
function startPixTimer() {
  stopPixTimer();
  const tick = () => {
    document.querySelectorAll('[data-countdown]').forEach(el => {
      const left = Math.max(0, +el.dataset.countdown - Date.now());
      el.textContent = `${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
    });
  };
  tick();
  pixTimer = setInterval(tick, 1000);
}
function stopPixTimer() { clearInterval(pixTimer); pixTimer = null; }
const luhn = n => { let sum = 0; [...n].reverse().forEach((d, i) => { let v = +d; if (i % 2) { v *= 2; if (v > 9) v -= 9; } sum += v; }); return n.length >= 13 && sum % 10 === 0; };
const cardBrand = n => /^4/.test(n) ? 'VISA' : /^(5[1-5]|2[2-7])/.test(n) ? 'MASTERCARD' : /^3[47]/.test(n) ? 'AMEX' : /^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(n) ? 'ELO' : /^(606282|3841)/.test(n) ? 'HIPERCARD' : 'CARTÃO';
async function processPayment(method, meta = {}) {
  const o = getOrder(pay.orderId);
  if (!o) return;
  const b = state.bookings.find(x => x.orderId === o.id && x.status === 'pending_payment');
  if (b && !isLive(b)) { pay.error = 'O tempo de reserva do horário expirou. Faça um novo agendamento.'; pay.stage = 'form'; renderCheckout(); return; }
  pay.stage = 'processing'; renderCheckout();
  await new Promise(r => setTimeout(r, method === 'pix' ? 1300 : 2000));
  if (!pay) return;
  if (meta.declined) { pay.stage = 'form'; pay.error = 'Pagamento recusado pela operadora. Verifique os dados ou use outro cartão.'; pay.method = 'card'; renderCheckout(); return; }
  const amount = Math.min(pay.amount, remaining(o)), paidBefore = o.paid;
  o.paid = Math.round((o.paid + amount) * 100) / 100;
  o.status = o.paid >= o.total ? 'paid' : 'active';
  state.payments.push({ id: uid(), orderId: o.id, student: o.student, amount, method, kind: amount >= o.total ? 'integral' : paidBefore < deposit(o) ? 'sinal' : 'restante', status: 'paid', at: Date.now(), txid: pay.txid, last4: meta.last4, brand: meta.brand, installments: meta.installments || 1 });
  const st = getStudent(o.student), p = getPlace(o.place);
  const waiting = state.bookings.filter(x => x.orderId === o.id && x.status === 'pending_payment');
  for (const x of waiting) { x.status = S().autoConfirm ? 'confirmed' : 'awaiting'; x.holdUntil = null; x.createdAt = Date.now(); }
  pay.paidAmount = amount; pay.method = method; pay.stage = 'approved';
  save(); render(); renderCheckout();
  const via = method === 'pix' ? 'via Pix' : `no cartão${meta.installments > 1 ? ` em ${meta.installments}x` : ''}`;
  if (waiting.length) {
    const x = waiting[0];
    inbox(st.id, 'Pagamento aprovado', `Recebemos ${money(amount)}. ${S().autoConfirm ? 'Sua aula está confirmada.' : 'Agora é só aguardar a confirmação do instrutor.'}`, x.id);
    notifyAdmin(`Novo agendamento · ${amount >= o.total ? 'pago' : 'sinal pago'}`, `${st.name} · ${p.short} · ${fmtShort(x.date)} às ${x.time}${x.people > 1 ? ' · 2 pessoas' : ''} · ${money(amount)} ${via}`, x.id);
  } else {
    notifyAdmin('Pagamento recebido', `${st.name} pagou ${money(amount)} ${via} · pedido ${o.code}`, null);
  }
}

/* =========================================================================
   Painel do instrutor
   ========================================================================= */
function adminHome() {
  const t = today(), monthKey = t.slice(0, 7);
  const todays = state.bookings.filter(b => b.date === t && LIVE.concat('done', 'no_show').includes(b.status)).sort(byTime);
  const awaiting = state.bookings.filter(b => b.status === 'awaiting').sort(byTime);
  const received = state.payments.filter(x => x.status === 'paid' && new Date(x.at).toISOString().slice(0, 7) === monthKey).reduce((n, x) => n + x.amount, 0);
  const receivable = openOrders().reduce((n, o) => n + remaining(o), 0);
  const upcoming = state.bookings.filter(b => b.status === 'confirmed' && !isPastSlot(b.date, b.time) && b.date !== t).sort(byTime).slice(0, 4);
  const feed = state.inbox.filter(n => n.to === 'admin').sort((a, b) => b.at - a.at).slice(0, 5);
  return `<div class="page-content">${title(`${greeting()}, ${esc(S().instructor.split(' ')[0])}.`, fmt(t, { weekday: 'long', day: 'numeric', month: 'long' }) + ' · tudo pronto para a próxima sessão?', btn('Novo agendamento', 'manual-booking', '', 'plus'))}
  <div class="stats four">
    <button type="button" class="card stat" data-action="nav:agenda"><small>AULAS HOJE</small><strong>${todays.filter(b => b.status !== 'no_show').length}</strong><span>${todays.length ? todays.map(b => b.time).slice(0, 3).join(' · ') : 'Dia livre'}</span></button>
    <button type="button" class="card stat ${awaiting.length ? 'alert' : ''}" data-action="nav:requests"><small>PARA CONFIRMAR</small><strong>${awaiting.length}</strong><span>${awaiting.length ? 'Pedidos com sinal pago' : 'Nada pendente'}</span></button>
    <button type="button" class="card stat" data-action="nav:finance"><small>RECEBIDO NO MÊS</small><strong>${money(received)}</strong><span>Pix e cartão</span></button>
    <button type="button" class="card stat" data-action="nav:finance"><small>A RECEBER</small><strong>${money(receivable)}</strong><span>Restantes de sinais</span></button>
  </div>
  <div class="admin-grid"><div>
    <div class="section-head"><h2>Pedidos para confirmar</h2><button type="button" class="text-btn" data-action="nav:requests">Ver todas as reservas ${icon('arrow')}</button></div>
    <div class="list-stack">${awaiting.length ? awaiting.map(requestRow).join('') : emptyState('check', 'Tudo confirmado.', 'Novos pedidos aparecem aqui e chegam como notificação no seu celular.')}</div>
    <div class="section-head"><h2>Hoje no mar</h2><button type="button" class="text-btn" data-action="nav:agenda">Abrir agenda ${icon('arrow')}</button></div>
    <div class="list-stack">${todays.length ? todays.map(b => lessonCard(b, true)).join('') : emptyState('sun', 'Nenhuma aula hoje.', 'Aproveite para cuidar do quiver ou pegar umas ondas.')}</div>
    ${upcoming.length ? `<div class="section-head"><h2>Próximas aulas confirmadas</h2></div><div class="list-stack">${upcoming.map(b => lessonCard(b, true)).join('')}</div>` : ''}
  </div><aside>
    <section class="card push-card"><div class="row between"><h3>${icon('bell')} Notificações push</h3></div><p class="muted" style="font-size:12px;margin:8px 0 14px">Receba um aviso no celular a cada novo agendamento, pagamento ou remarcação.</p>
      <div class="push-status" id="push-status"><span class="pulse-dot gray"></span>Verificando…</div>
      <div class="push-actions">${btn('Ativar neste aparelho', 'push-enable', 'secondary', 'bell', 'id="push-enable"')}${btn('Enviar push de teste', 'push-test', '', 'send')}</div>
      <p class="legal-note spacer" id="push-help">No iPhone, instale o app na Tela de Início para receber notificações (iOS 16.4+).</p>
    </section>
    <section class="card spacer"><div class="row between"><h3>Atividade recente</h3><button type="button" class="text-btn" data-action="notices">Ver tudo</button></div>
      ${feed.map(n => `<button type="button" class="feed-item ${n.read ? '' : 'unread'}" data-action="${n.booking && getBooking(n.booking) ? 'admin-booking:' + n.booking : 'notices'}"><strong>${esc(n.title)}</strong><small>${esc(n.body)}</small><em>${ago(n.at)}</em></button>`).join('') || '<p class="muted spacer">Sem atividade ainda.</p>'}
    </section>
    <section class="card spacer quiver-mini"><div class="row between"><h3>Quiver</h3><button type="button" class="text-btn" data-action="nav:quiver">Gerenciar ${icon('arrow')}</button></div>
      <div class="quiver-strip">${state.boards.slice(0, 6).map(b => `<div class="${b.available && b.condition === 'ok' ? '' : 'off'}" title="${esc(b.name)}">${boardImg(b)}</div>`).join('')}</div>
      <p class="legal-note">${state.boards.filter(b => b.available && b.condition === 'ok').length} de ${state.boards.length} pranchas liberadas para alunos.</p>
    </section>
  </aside></div></div>`;
}
function requestRow(b) {
  const st = getStudent(b.student), o = getOrder(b.orderId), p = getPlace(b.place);
  const lastPay = state.payments.filter(x => x.orderId === o?.id && x.status === 'paid').sort((a, c) => c.at - a.at)[0];
  return `<article class="card request"><div class="avatar">${initials(st.name)}</div>
    <div class="class-info"><h3>${esc(st.name)} <small class="muted">· ${esc(st.level)}</small></h3>
      <div class="class-meta"><span>${icon('calendar')}${fmtShort(b.date)} · ${b.time}</span><span>${icon('pin')}${esc(p.short)}</span><span>${icon(b.people > 1 ? 'users' : 'user')}${b.people > 1 ? 'Dupla' : 'Individual'}</span><span>${icon('money')}${o ? (o.plan === 'single' ? 'Avulsa' : PLANS[o.plan].label) + (lastPay ? ` · ${money(o.paid)} pago (${lastPay.method === 'pix' ? 'Pix' : 'cartão'})` : ' · crédito de pacote') : ''}</span></div>
      <small class="muted">${b.rescheduled ? 'Remarcada · ' : ''}Pedido ${ago(b.createdAt)}</small></div>
    <div class="request-actions">${btn('Recusar', 'decline:' + b.id, 'secondary')}${btn('Confirmar', 'confirm-booking:' + b.id, '', 'check')}</div></article>`;
}
async function refreshPushStatus() {
  const el = $('#push-status');
  if (!el) return;
  pushInfo = await Push.status();
  const target = $('#push-status');
  if (!target) return;
  const dot = { push: '', local: '', off: 'gray', denied: 'red', unsupported: 'red' }[pushInfo.state];
  target.innerHTML = `<span class="pulse-dot ${dot}"></span>${esc(pushInfo.label)}`;
  const enableBtn = $('#push-enable');
  if (enableBtn) {
    const on = pushInfo.state === 'push' || pushInfo.state === 'local';
    enableBtn.dataset.action = on ? 'push-disable' : 'push-enable';
    enableBtn.innerHTML = (on ? 'Desativar neste aparelho' : 'Ativar neste aparelho') + icon('bell');
    enableBtn.disabled = pushInfo.state === 'unsupported';
  }
  const help = $('#push-help');
  if (help && pushInfo.state !== 'push' && !pushInfo.server) help.innerHTML = 'Servidor push não configurado: as notificações aparecem só neste aparelho. Configure as chaves VAPID na Vercel (veja o LEIA-ME) para receber no celular mesmo com o app fechado.';
}
async function enablePush() {
  try { const st = await Push.enable(); toast(st.state === 'push' ? 'Notificações ativadas! Você vai receber os agendamentos no celular.' : 'Notificações ativadas neste aparelho.'); }
  catch (e) { toast(e.message); }
  refreshPushStatus();
  return pushInfo;
}
async function testPush() {
  let st = await Push.status();
  if (st.state === 'off') st = await enablePush();
  const r = await notifyAdmin('Teste de notificação 🏄', `Tudo certo! Você vai receber um aviso a cada novo agendamento. Enviado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`, null);
  render();
  toast(r.via === 'push' ? `Push enviado pelo servidor para ${r.sent} aparelho(s).` : r.via === 'local' ? 'Notificação exibida neste aparelho (modo local).' : 'Notificação registrada no app. Permita notificações no navegador para recebê-las.');
}

function agenda() {
  const days = Array.from({ length: 14 }, (_, i) => addDays(agendaStart, i));
  const d = agendaDate;
  const col = p => {
    if (!isClassDay(p.id, d)) return `<div class="agenda-col"><div class="agenda-head"><h3>${esc(p.name)}</h3></div><div class="empty small">${icon('moon')}<p>Sem aulas às ${DAY_NAMES[weekday(d)]}s.</p></div></div>`;
    const blockedDay = dayBlock(p.id, d), tide = p.schedule === 'tide' ? tideFor(d) : null;
    const bookings = state.bookings.filter(b => b.place === p.id && b.date === d && (isLive(b) || ['done', 'no_show'].includes(b.status)));
    const slots = slotsFor(p.id, d);
    const extra = bookings.filter(b => !slots.some(s => s.time === b.time)).map(b => b.time);
    const times = [...new Set(slots.map(s => s.time).concat(extra))].sort();
    return `<div class="agenda-col"><div class="agenda-head"><div><h3>${esc(p.name)}</h3><small>${esc(p.modality)} · ${p.capacity > 1 ? 'até 2 por horário' : '1 aluno por horário'}</small></div>
      ${blockedDay ? btn('Liberar dia', 'unblock:' + blockedDay.id, 'secondary small') : btn('Bloquear dia', `block-day:${p.id}|${d}`, 'secondary small', 'block')}</div>
      ${tide ? `<button type="button" class="tide-note as-btn" data-action="edit-tide:${d}">${icon('tide')}<span>Maré: aulas pela <strong>${tide.period}</strong> · ${tide.hours.join(', ')}${tide.estimated ? ' <em>(estimativa)</em>' : ''}</span>${icon('edit')}</button>` : ''}
      ${blockedDay ? `<div class="notice">${icon('block')}<p>Dia bloqueado${blockedDay.reason ? ': ' + esc(blockedDay.reason) : ''}. Alunos não conseguem agendar.</p></div>` : ''}
      ${times.map(time => {
        const s = slots.find(x => x.time === time), here = bookings.filter(b => b.time === time), block = s && s.block && !blockedDay ? s.block : null;
        return `<div class="agenda-slot ${here.length ? 'busy' : ''} ${block ? 'blocked' : ''}"><div class="agenda-time"><strong>${time}</strong><small>${addHour(time)}</small></div><div class="agenda-body">
          ${here.map(b => `<button type="button" class="agenda-booking ${b.status}" data-action="admin-booking:${b.id}"><span class="avatar sm">${initials(getStudent(b.student).name)}</span><span><strong>${esc(getStudent(b.student).name)}${b.people > 1 ? ' +1' : ''}</strong><small>${STATUS[b.status][0]}${getBoard(b.board) ? ' · ' + esc(getBoard(b.board).name) : ''}</small></span></button>`).join('')}
          ${block ? `<span class="muted small">${icon('block')} Bloqueado${block.reason ? ' · ' + esc(block.reason) : ''}</span>${btn('Liberar', 'unblock:' + block.id, 'secondary small')}` : ''}
          ${s && !block && !blockedDay && s.free > 0 && !s.past ? `<span class="free">${here.length ? `${s.free} vaga livre` : 'Livre'}</span><span class="slot-tools">${btn('Agendar', `manual-booking:${p.id}|${d}|${time}`, 'subtle small', 'plus')}${!here.length ? btn('Bloquear', `block-slot:${p.id}|${d}|${time}`, 'subtle small', 'block') : ''}</span>` : ''}
          ${!here.length && s && s.past && !block ? '<span class="muted small">Encerrado</span>' : ''}
        </div></div>`;
      }).join('') || '<p class="muted">Sem horários definidos.</p>'}
    </div>`;
  };
  return `<div class="page-content">${title('Agenda das aulas.', 'Veja quem vai para o mar, bloqueie horários e ajuste a maré do Farol.', btn('Novo agendamento', 'manual-booking', '', 'plus'))}
    <div class="date-navigation"><strong style="font-size:12px">${fmt(agendaStart, { month: 'long', year: 'numeric' })}</strong><div class="row"><button type="button" class="btn secondary small" data-action="agenda-today">Hoje</button><button type="button" class="icon-btn" data-action="agenda-week:-7" aria-label="Semana anterior">${icon('left')}</button><button type="button" class="icon-btn" data-action="agenda-week:7" aria-label="Próxima semana">${icon('chevron')}</button></div></div>
    <div class="dates scroll">${days.map(x => { const n = state.bookings.filter(b => b.date === x && isLive(b)).length; return `<button type="button" class="day ${x === d ? 'active' : ''} ${weekday(x) === 2 ? 'off' : ''}" data-action="agenda-date:${x}"><small>${fmt(x, { weekday: 'short' }).replace('.', '')}</small><strong>${fmt(x, { day: '2-digit' })}</strong>${n ? `<em>${n}</em>` : ''}</button>`; }).join('')}</div>
    <h2 class="agenda-title">${fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
    <div class="agenda-cols">${state.places.map(col).join('')}</div></div>`;
}

function requests() {
  const groups = {
    awaiting: ['Para confirmar', b => b.status === 'awaiting'],
    confirmed: ['Confirmadas', b => b.status === 'confirmed' && !isPastSlot(b.date, b.time)],
    pending: ['Aguardando pagamento', b => b.status === 'pending_payment' && isLive(b)],
    attendance: ['Registrar presença', b => b.status === 'confirmed' && isPastSlot(b.date, b.time)],
    history: ['Histórico', b => ['done', 'no_show', 'cancelled', 'declined', 'expired'].includes(b.status)],
  };
  const [, filter] = groups[reqTab];
  const list = state.bookings.filter(filter).sort(byTime);
  if (reqTab === 'history') list.reverse();
  return `<div class="page-content">${title('Reservas.', 'Confirme pedidos, acompanhe pagamentos e registre a presença.', btn('Novo agendamento', 'manual-booking', '', 'plus'))}
  <div class="tabs">${Object.entries(groups).map(([k, [l, f]]) => `<button type="button" data-action="req-tab:${k}" class="${reqTab === k ? 'active' : ''}">${l} (${state.bookings.filter(f).length})</button>`).join('')}</div>
  <div class="list-stack">${list.length ? list.map(b => reqTab === 'awaiting' ? requestRow(b) : lessonCard(b, true)).join('') : emptyState('check', 'Nada por aqui.', 'Quando houver reservas nesta etapa, elas aparecem nesta lista.')}</div></div>`;
}

function adminBooking(id) {
  const b = getBooking(id);
  if (!b) return toast('Reserva não encontrada.');
  const st = getStudent(b.student), p = getPlace(b.place), o = getOrder(b.orderId), past = isPastSlot(b.date, b.time);
  const pays = state.payments.filter(x => x.orderId === o?.id).sort((a, c) => a.at - c.at);
  const avail = state.boards.filter(x => (x.available && x.condition === 'ok') || x.id === b.board);
  modal(`${esc(st.name)} · ${b.time}`, `<div class="row between">${statusBadge(b)}<small class="muted">Reserva ${esc(b.code)}</small></div>
    ${detail('Data', fmt(b.date, { weekday: 'long', day: 'numeric', month: 'long' }))}${detail('Local', esc(p.name))}${detail('Formato', b.people > 1 ? `Dupla · com ${esc(o?.companion || 'acompanhante')}` : 'Individual')}${detail('Aluno', `${esc(st.level)} · <a href="${whatsapp(st.phone, `Olá ${st.name.split(' ')[0]}! Aqui é o ${S().instructor.split(' ')[0]}, sobre sua aula de ${fmtShort(b.date)} às ${b.time}.`)}" target="_blank" rel="noopener" class="link">${esc(st.phone)} ${icon('phone')}</a>`)}
    ${b.rescheduled ? detail('Remarcações', `${b.rescheduled} (limite do aluno: 1)`) : ''}
    ${o ? `<div class="pay-box"><div class="row between"><strong>${PLANS[o.plan].label} · ${money(o.total)}</strong><span class="badge ${remaining(o) ? 'orange' : ''}">${o.status === 'refunded' ? 'ESTORNADO' : remaining(o) ? 'FALTA ' + money(remaining(o)) : 'QUITADO'}</span></div>
      ${o.plan !== 'single' ? `<small class="muted">Créditos: ${creditsUsed(o)} de ${PLANS[o.plan].lessons} usados · válido até ${fmt(o.expiresAt)}</small>` : ''}
      ${pays.map(x => `<div class="tx"><span>${icon(x.method === 'pix' ? 'pix' : x.method === 'card' ? 'card' : 'money')}${new Date(x.at).toLocaleDateString('pt-BR')} · ${x.kind}${x.last4 ? ` · ${x.brand} •${x.last4}` : ''}</span><strong class="${x.status === 'refunded' ? 'strike' : ''}">${money(x.amount)}</strong></div>`).join('') || '<small class="muted">Nenhum pagamento registrado.</small>'}
      ${remaining(o) && o.status !== 'refunded' ? `<div class="row wrap spacer-sm">${btn('Recebi o restante (Pix)', `receive:${o.id}|pix`, 'subtle small', 'pix')}${btn('Recebi em dinheiro', `receive:${o.id}|cash`, 'subtle small', 'money')}</div>` : ''}</div>` : ''}
    <h3 class="subsection">Prancha para esta aula</h3>
    <div class="board-picker">${avail.map(x => `<button type="button" class="${b.board === x.id ? 'active' : ''}" data-action="assign-board:${b.id}|${x.id}" title="${esc(x.name)}">${boardImg(x)}<small>${esc(x.name)}<br>${esc(x.size)}</small></button>`).join('')}</div>
    ${b.history?.length ? `<h3 class="subsection">Histórico</h3>${b.history.map(h => `<p class="legal-note">${new Date(h.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · ${esc(h.text)}</p>`).join('')}` : ''}
    <div class="modal-actions wrap">
      ${b.status === 'awaiting' ? btn('Recusar', 'decline:' + b.id, 'danger') + btn('Confirmar aula', 'confirm-booking:' + b.id, '', 'check') : ''}
      ${b.status === 'confirmed' && past ? btn('Faltou', 'attend:' + b.id + '|no_show', 'secondary') + btn('Aula realizada', 'attend:' + b.id + '|done', '', 'check') : ''}
      ${LIVE.includes(b.status) && !past ? btn('Remarcar', 'admin-move:' + b.id, 'secondary', 'calendar') + (b.status === 'confirmed' ? btn('Cancelar aula', 'decline:' + b.id, 'danger') : '') : ''}
      ${btn('Ficha do aluno', 'student:' + st.id, 'subtle', 'user')}
    </div>`);
}

function quiver() {
  const avail = state.boards.filter(b => b.available && b.condition === 'ok').length;
  return `<div class="page-content">${title('Seu quiver.', `${state.boards.length} pranchas · ${avail} liberadas para os alunos. Fotografe uma prancha e o fundo é recortado automaticamente.`, btn('Fotografar prancha', 'edit-board:new', '', 'camera'))}
  <div class="board-gallery">${state.boards.map(b => boardCard(b, { admin: true })).join('')}
    <button type="button" class="card add-board" data-action="edit-board:new">${icon('camera')}<strong>Adicionar prancha</strong><small>Tire uma foto da prancha inteira sobre um fundo liso.</small></button>
  </div></div>`;
}
function editBoard(id) {
  const b = id === 'new' ? { name: '', size: '', volume: '', type: 'Longboard', level: 'Iniciante', image: '', available: true, condition: 'ok', desc: '' } : getBoard(id);
  cut = { img: null, tol: 28, dataUrl: b.image };
  modal(id === 'new' ? 'Nova prancha no quiver' : 'Editar prancha', `<form data-form="board" data-id="${id}">
    <div class="cutout">
      <div class="cutout-stage checker" id="cutout-stage">${b.image ? `<img src="${esc(b.image)}" alt="Prévia da prancha">` : `<div class="cutout-empty">${icon('camera')}<p>Fotografe a prancha inteira, de frente, sobre uma parede ou chão liso.</p></div>`}</div>
      <div class="cutout-tools">
        <label class="btn" for="board-photo">${icon('camera')} ${b.image ? 'Trocar foto' : 'Tirar foto'}</label>
        <input type="file" id="board-photo" accept="image/*" capture="environment" hidden>
        <div class="field" id="tol-field" ${cut.img ? '' : 'hidden'}><label for="cut-tol">Ajuste do recorte</label><input type="range" id="cut-tol" min="6" max="90" value="${cut.tol}"><small class="muted">Se sobrou fundo, aumente. Se cortou a prancha, diminua.</small></div>
        <p class="legal-note" id="cut-msg">O recorte do fundo acontece no seu aparelho, sem enviar a foto para fora.</p>
      </div>
    </div>
    <div class="field"><label for="b-name">Nome</label><input id="b-name" name="name" required maxlength="60" value="${esc(b.name)}" placeholder="Ex.: Longboard Amarela"></div>
    <div class="fields"><div class="field"><label for="b-size">Tamanho</label><input id="b-size" name="size" required maxlength="12" value="${esc(b.size)}" placeholder="9’0”"></div><div class="field"><label for="b-volume">Volume</label><input id="b-volume" name="volume" maxlength="12" value="${esc(b.volume)}" placeholder="75 L"></div>
    <div class="field"><label for="b-type">Tipo</label><select id="b-type" name="type">${BOARD_TYPES.map(t => `<option ${b.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div><div class="field"><label for="b-level">Indicada para</label><select id="b-level" name="level">${levels.map(t => `<option ${b.level === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
    <div class="field"><label for="b-desc">Descrição para o aluno</label><input id="b-desc" name="desc" maxlength="200" value="${esc(b.desc)}"></div>
    <div class="fields"><div class="field"><label for="b-condition">Estado</label><select id="b-condition" name="condition"><option value="ok" ${b.condition === 'ok' ? 'selected' : ''}>Pronta para uso</option><option value="reparo" ${b.condition === 'reparo' ? 'selected' : ''}>Em reparo</option></select></div>
    <label class="switch big"><input type="checkbox" name="available" ${b.available ? 'checked' : ''}><span></span>Disponibilizar para alunos</label></div>
    <div class="modal-actions wrap">${id !== 'new' ? btn('Remover', 'delete-board:' + id, 'danger', 'trash') : ''}<button class="btn" type="submit">Salvar no quiver ${icon('check')}</button></div>
  </form>`, 'wide');
}
async function runCutout() {
  const stage = $('#cutout-stage'), msg = $('#cut-msg');
  if (!cut.img || !stage) return;
  msg.textContent = 'Recortando o fundo…';
  await new Promise(r => setTimeout(r, 30));
  try {
    const res = Cutout.process(cut.img, cut.tol);
    cut.dataUrl = res.dataUrl;
    stage.innerHTML = `<img src="${res.dataUrl}" alt="Prancha recortada">`;
    msg.textContent = res.coverage > 0.92 ? 'O fundo parece igual à prancha. Tente outra foto com fundo de cor diferente.' : 'Fundo removido! Ajuste a sensibilidade se necessário.';
  } catch (e) { msg.textContent = e.message; }
}

function students() {
  const q = studentFilter.toLocaleLowerCase('pt');
  const ss = state.students.filter(s => s.name.toLocaleLowerCase('pt').includes(q));
  return `<div class="page-content">${title('Seus alunos.', 'Acompanhe a evolução, os pacotes e a prancha de cada um.', btn('Novo aluno', 'edit-student:new', '', 'plus'))}
  <div class="filters"><input class="search" id="student-search" placeholder="Buscar aluno pelo nome…" aria-label="Buscar aluno" value="${esc(studentFilter)}"></div>
  <div class="list-stack">${ss.map(s => { const next = state.bookings.filter(b => b.student === s.id && isLive(b) && !isPastSlot(b.date, b.time)).sort(byTime)[0], packs = activePackages(s.id); return `<button type="button" class="student-row" data-action="student:${s.id}"><div class="avatar">${initials(s.name)}</div><div class="info"><h3>${esc(s.name)}</h3><p>${esc(s.level)}${next ? ` · próxima: ${fmtShort(next.date)} ${next.time} (${esc(placeName(next.place))})` : ''}</p></div>${packs.length ? `<span class="badge orange">${packs.reduce((n, o) => n + creditsLeft(o), 0)} CRÉDITOS</span>` : ''}${icon('chevron')}</button>`; }).join('') || '<div class="empty">Nenhum aluno encontrado.</div>'}</div></div>`;
}
function studentProfile(s) {
  if (!s) return students();
  const bs = state.bookings.filter(b => b.student === s.id && b.status !== 'expired').sort(byTime).reverse();
  const orders = state.orders.filter(o => o.student === s.id && o.status !== 'expired');
  return `<div class="page-content">${title('Ficha do aluno', 'Evolução, pagamentos e orientações.', btn('Voltar', 'nav:students', 'secondary', 'left'))}
  <div class="profile-layout"><div>
    <section class="card"><div class="profile-head"><div class="avatar big">${initials(s.name)}</div><div><h2>${esc(s.name)}</h2><p>${esc(s.email)}</p><span class="badge orange">${esc(s.level)}</span></div></div>
      ${detail('WhatsApp', `<a class="link" href="${whatsapp(s.phone)}" target="_blank" rel="noopener">${esc(s.phone) || '—'} ${icon('phone')}</a>`)}${detail('Aulas realizadas', bs.filter(b => b.status === 'done').length)}${detail('Faltas', bs.filter(b => b.status === 'no_show').length)}
      <div class="row wrap spacer">${btn('Editar aluno', 'edit-student:' + s.id, 'secondary', 'edit')}${btn('Agendar para este aluno', 'manual-booking:||', 'subtle', 'plus', `data-student="${s.id}"`)}</div></section>
    <section class="card spacer"><h3>Pacotes e pedidos</h3>${orders.map(o => detail(`${PLANS[o.plan].label} · ${esc(placeName(o.place))}${o.plan !== 'single' ? ` <small class="muted">· ${creditsLeft(o)} restantes · até ${fmt(o.expiresAt, { day: '2-digit', month: '2-digit' })}</small>` : ''}`, `${money(o.paid)} / ${money(o.total)}`)).join('') || '<p class="muted spacer">Nenhum pedido.</p>'}</section>
    <section class="card spacer"><h3>Aulas</h3><div class="list-stack spacer">${bs.map(b => `<button type="button" class="detail-row as-btn" data-action="admin-booking:${b.id}"><span>${fmtShort(b.date)} · ${b.time} · ${esc(placeName(b.place))}</span><strong>${STATUS[b.status][0]}</strong></button>`).join('') || '<p class="muted">Nenhuma aula.</p>'}</div></section>
    <section class="card spacer"><h3>Anotações internas</h3><p class="legal-note">Só você vê.</p>${s.notes.map(n => `<div class="note"><small>${fmt(n.date)}</small><p>${esc(n.text)}</p></div>`).join('') || '<p class="muted spacer">Nenhuma anotação.</p>'}
      <form data-form="note" data-student="${s.id}" data-visibility="internal" class="spacer"><div class="field"><label for="internal-note">Nova anotação</label><textarea id="internal-note" name="text" required maxlength="2000" placeholder="O que você observou nesta sessão?"></textarea></div><button class="btn" type="submit">Salvar anotação ${icon('plus')}</button></form></section>
    <section class="card spacer"><h3>Orientações para o aluno</h3>${s.shared.map(n => `<div class="note"><small>${fmt(n.date)}</small><p>${esc(n.text)}</p></div>`).join('') || '<p class="muted spacer">Nenhuma orientação.</p>'}
      <form data-form="note" data-student="${s.id}" data-visibility="shared" class="spacer"><div class="field"><label for="shared-note">Nova orientação · o aluno recebe uma notificação</label><textarea id="shared-note" name="text" required maxlength="2000"></textarea></div><button class="btn" type="submit">Enviar orientação ${icon('send')}</button></form></section>
  </div>${boardCard(getBoard(s.board), { eyebrow: 'PRANCHA HABITUAL' })}</div></div>`;
}

function finance() {
  const monthKey = today().slice(0, 7), paid = state.payments.filter(x => x.status === 'paid');
  const month = paid.filter(x => new Date(x.at).toISOString().slice(0, 7) === monthKey);
  const open = openOrders();
  const packs = state.orders.filter(o => o.plan !== 'single' && ['active', 'paid'].includes(o.status) && o.expiresAt >= today());
  return `<div class="page-content">${title('Financeiro.', 'Sinais, restantes e valores das aulas.', btn('Configurações', 'settings', 'secondary', 'settings'))}
  <div class="stats four">
    <div class="card stat"><small>RECEBIDO NO MÊS</small><strong>${money(month.reduce((n, x) => n + x.amount, 0))}</strong><span>${month.length} pagamentos</span></div>
    <div class="card stat"><small>A RECEBER</small><strong>${money(open.reduce((n, o) => n + remaining(o), 0))}</strong><span>${open.filter(o => remaining(o) > 0).length} pedidos com saldo</span></div>
    <div class="card stat"><small>VIA PIX</small><strong>${money(month.filter(x => x.method === 'pix').reduce((n, x) => n + x.amount, 0))}</strong><span>no mês</span></div>
    <div class="card stat"><small>PACOTES ATIVOS</small><strong>${packs.length}</strong><span>${packs.reduce((n, o) => n + creditsLeft(o), 0)} aulas a realizar</span></div>
  </div>
  <div class="admin-grid"><div>
    <div class="section-head"><h2>Saldos a receber</h2></div>
    <div class="card table">${open.filter(o => remaining(o) > 0).map(o => `<div class="tx-row"><div><strong>${esc(getStudent(o.student).name)}</strong><small>${PLANS[o.plan].label} · ${esc(placeName(o.place))} · ${esc(o.code)}</small></div><div class="right"><strong>${money(remaining(o))}</strong><small>pago ${money(o.paid)} de ${money(o.total)}</small></div>${o.paid > 0 ? btn('Recebi', `receive:${o.id}|pix`, 'subtle small', 'check') : '<span class="badge gray">SEM SINAL</span>'}</div>`).join('') || '<p class="muted">Nenhum saldo em aberto.</p>'}</div>
    <div class="section-head"><h2>Últimos pagamentos</h2></div>
    <div class="card table">${state.payments.slice().sort((a, b) => b.at - a.at).slice(0, 15).map(x => `<div class="tx-row"><div><strong>${esc(getStudent(x.student)?.name || '')}</strong><small>${new Date(x.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · ${x.kind} · ${x.method === 'pix' ? 'Pix' : x.method === 'card' ? `Cartão${x.brand ? ' ' + x.brand : ''}${x.installments > 1 ? ' ' + x.installments + 'x' : ''}` : 'Dinheiro'}</small></div><div class="right"><strong class="${x.status === 'refunded' ? 'strike' : ''}">${money(x.amount)}</strong><small>${x.status === 'refunded' ? 'estornado' : esc(x.txid || '')}</small></div></div>`).join('') || '<p class="muted">Nenhum pagamento.</p>'}</div>
  </div><aside>
    <form class="card" data-form="prices"><h3>Valores das aulas</h3><p class="legal-note">Alterações valem para novos pedidos.</p>
      ${state.places.map(p => `<h4 class="subsection">${esc(p.name)} <small class="muted">· ${esc(p.modality)}</small></h4>${Object.entries(PLANS).map(([k, plan]) => `<div class="field inline"><label for="pr-${p.id}-${k}">${plan.label}${plan.validity ? ` <small>(${plan.validity} dias)</small>` : ''}</label><input id="pr-${p.id}-${k}" name="${p.id}.${k}" type="number" min="1" step="1" value="${p.prices[k]}" required></div>`).join('')}`).join('')}
      <div class="field inline"><label for="pr-deposit">Sinal para confirmar (%)</label><input id="pr-deposit" name="depositPct" type="number" min="10" max="100" value="${S().depositPct}" required></div>
      <button class="btn full" type="submit">Salvar valores ${icon('check')}</button></form>
    <div class="card spacer"><h3>Recebimento via Pix</h3>${detail('Chave (celular)', esc(phoneLabel(S().phone)))}${detail('Nome', esc(S().pixName))}<p class="legal-note spacer">O QR Code do checkout é gerado com esta chave e o valor exato do pedido.</p></div>
  </aside></div></div>`;
}

/* ---------- Ações do instrutor ---------- */
function confirmBooking(id) {
  const b = getBooking(id);
  if (!b || b.status !== 'awaiting') return;
  b.status = 'confirmed';
  b.history.push({ at: Date.now(), text: 'Confirmada pelo instrutor' });
  const board = getBoard(b.board);
  inbox(b.student, 'Aula confirmada! 🤙', `${S().instructor.split(' ')[0]} confirmou sua aula de ${fmtShort(b.date)} às ${b.time} em ${placeName(b.place)}.${board ? ` Sua prancha: ${board.name} ${board.size}.` : ''}`, b.id);
  save(); close(); render();
  toast(`Aula de ${getStudent(b.student).name.split(' ')[0]} confirmada. O aluno foi avisado.`);
}
function declineBooking(id, reason) {
  const b = getBooking(id), o = getOrder(b.orderId);
  const wasConfirmed = b.status === 'confirmed';
  b.status = wasConfirmed ? 'cancelled' : 'declined';
  b.reason = reason;
  b.history.push({ at: Date.now(), text: (wasConfirmed ? 'Cancelada' : 'Recusada') + ' pelo instrutor: ' + reason });
  let refund = 0;
  if (o && o.plan === 'single' && o.paid > 0) {
    for (const x of state.payments.filter(x => x.orderId === o.id && x.status === 'paid')) { x.status = 'refunded'; refund += x.amount; }
    o.status = 'refunded';
  }
  inbox(b.student, wasConfirmed ? 'Aula cancelada' : 'Horário não confirmado', `${reason}${refund ? ` O valor de ${money(refund)} será estornado.` : o && o.plan !== 'single' ? ' O crédito voltou para o seu pacote.' : ''}`, b.id);
  save(); close(); render();
  toast(refund ? `Reserva ${wasConfirmed ? 'cancelada' : 'recusada'} e ${money(refund)} estornado.` : `Reserva ${wasConfirmed ? 'cancelada' : 'recusada'}.`);
}
function receive(orderId, method) {
  const o = getOrder(orderId), amount = remaining(o);
  if (!amount) return;
  o.paid = o.total; o.status = 'paid';
  state.payments.push({ id: uid(), orderId, student: o.student, amount, method, kind: 'restante', status: 'paid', at: Date.now(), txid: method === 'cash' ? 'DINHEIRO' : 'PIX-MANUAL' });
  save(); render();
  if ($('#modal').open) { const b = state.bookings.find(x => x.orderId === orderId); if (b) adminBooking(b.id); }
  toast(`${money(amount)} registrado. Pedido quitado.`);
}

function manualBooking(preset = {}) {
  const placeId = preset.place || state.places[0].id, date = preset.date || agendaDate;
  modal('Novo agendamento', `<form data-form="manual"><p class="legal-note">Para alunos que combinaram pelo WhatsApp. A aula entra como confirmada.</p>
    <div class="field"><label for="mb-student">Aluno</label><select id="mb-student" name="student"><option value="new">+ Novo aluno</option>${state.students.map(s => `<option value="${s.id}" ${preset.student === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
    <div class="fields" id="mb-new" ${preset.student ? 'hidden' : ''}><div class="field"><label for="mb-name">Nome</label><input id="mb-name" name="name" maxlength="80"></div><div class="field"><label for="mb-phone">WhatsApp</label><input id="mb-phone" name="phone" type="tel" maxlength="30"></div></div>
    <div class="fields"><div class="field"><label for="mb-place">Local</label><select id="mb-place" name="place">${state.places.map(p => `<option value="${p.id}" ${p.id === placeId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
    <div class="field"><label for="mb-date">Data</label><input id="mb-date" name="date" type="date" min="${today()}" value="${date < today() ? today() : date}" required></div></div>
    <div class="fields"><div class="field"><label for="mb-time">Horário</label><select id="mb-time" name="time" required>${timeOptions(placeId, date < today() ? today() : date, preset.time)}</select></div>
    <div class="field"><label for="mb-people">Pessoas</label><select id="mb-people" name="people"><option value="1">1</option><option value="2">2 (Farol)</option></select></div></div>
    <div class="fields"><div class="field"><label for="mb-plan">Plano</label><select id="mb-plan" name="plan">${Object.entries(PLANS).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join('')}<option value="credit">Usar crédito de pacote</option></select></div>
    <div class="field"><label for="mb-paid">Pagamento recebido</label><select id="mb-paid" name="paid"><option value="deposit">Sinal (${S().depositPct}%) via Pix</option><option value="full">Valor total via Pix</option><option value="none">Ainda não recebi</option></select></div></div>
    <div class="modal-actions"><button class="btn" type="submit">Agendar e confirmar ${icon('check')}</button></div></form>`);
}
function timeOptions(placeId, date, selected) {
  const slots = slotsFor(placeId, date).filter(s => !s.past && !s.block && s.free > 0);
  return slots.map(s => `<option value="${s.time}" ${s.time === selected ? 'selected' : ''}>${s.time} · ${s.free} vaga(s)</option>`).join('') || '<option value="">Sem horários livres</option>';
}

function editTide(date) {
  const t = tideFor(date), hours = Array.from({ length: 12 }, (_, i) => String(6 + i).padStart(2, '0') + ':00');
  modal('Horários do Farol pela maré', `<form data-form="tide" data-date="${date}"><p class="muted" style="font-size:12px">${fmt(date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${t.estimated ? `estimativa: maré baixa ~${t.low}` : 'definido por você'}</p>
    <div class="hour-grid">${hours.map(h => `<label class="hour ${t.hours.includes(h) ? 'active' : ''}"><input type="checkbox" name="hours" value="${h}" ${t.hours.includes(h) ? 'checked' : ''}>${h}</label>`).join('')}</div>
    <p class="legal-note spacer">Marque os horários de início das aulas (1 hora cada). Confira a tábua de marés da Marinha para o Porto de Salvador.</p>
    <div class="modal-actions wrap">${!t.estimated ? btn('Voltar à estimativa', 'reset-tide:' + date, 'secondary', 'refresh') : ''}<button class="btn" type="submit">Salvar horários ${icon('check')}</button></div></form>`);
}

/* ---------- Modais gerais ---------- */
function editStudent(id) {
  const s = id === 'new' ? { name: '', email: '', phone: '', level: levels[0], board: 'b1' } : getStudent(id), admin = role === 'admin';
  modal(id === 'new' ? 'Novo aluno' : admin ? 'Editar aluno' : 'Seus dados', `<form data-form="student" data-id="${id}"><div class="field"><label for="s-name">Nome completo</label><input id="s-name" name="name" required maxlength="80" value="${esc(s.name)}"></div>
    <div class="fields"><div class="field"><label for="s-email">E-mail</label><input id="s-email" name="email" type="email" value="${esc(s.email)}"></div><div class="field"><label for="s-phone">WhatsApp</label><input id="s-phone" name="phone" type="tel" value="${esc(s.phone)}" maxlength="30"></div></div>
    ${admin ? `<div class="fields"><div class="field"><label for="s-level">Nível</label><select id="s-level" name="level">${levels.map(l => `<option ${s.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="field"><label for="s-board">Prancha habitual</label><select id="s-board" name="board">${state.boards.map(b => `<option value="${b.id}" ${s.board === b.id ? 'selected' : ''}>${esc(b.name)} ${esc(b.size)}</option>`).join('')}</select></div></div>` : ''}
    <div class="modal-actions"><button class="btn" type="submit">Salvar ${icon('check')}</button></div></form>`);
}
function settings() {
  const admin = role === 'admin';
  modal(admin ? 'Configurações' : 'Preferências', `<div class="field"><label for="theme-choice">Aparência</label><select id="theme-choice"><option value="system" ${theme === 'system' ? 'selected' : ''}>Seguir o sistema</option><option value="light" ${theme === 'light' ? 'selected' : ''}>Claro</option><option value="dark" ${theme === 'dark' ? 'selected' : ''}>Escuro</option></select></div>
    ${admin ? `<form data-form="settings"><div class="fields"><div class="field"><label for="st-school">Nome da escola</label><input id="st-school" name="school" required maxlength="60" value="${esc(S().school)}"></div><div class="field"><label for="st-instructor">Instrutor</label><input id="st-instructor" name="instructor" required maxlength="60" value="${esc(S().instructor)}"></div>
      <div class="field"><label for="st-phone">Celular / chave Pix</label><input id="st-phone" name="phone" required maxlength="20" value="${esc(phoneLabel(S().phone))}"></div><div class="field"><label for="st-pixname">Nome do recebedor Pix</label><input id="st-pixname" name="pixName" required maxlength="60" value="${esc(S().pixName)}"></div>
      <div class="field"><label for="st-hold">Reserva aguardando pagamento (min)</label><input id="st-hold" name="holdMinutes" type="number" min="5" max="240" value="${S().holdMinutes}"></div></div>
      <label class="switch big"><input type="checkbox" name="autoConfirm" ${S().autoConfirm ? 'checked' : ''}><span></span>Confirmar automaticamente quando o sinal for pago</label>
      <div class="modal-actions"><button class="btn" type="submit">Salvar configurações ${icon('check')}</button></div></form>` : ''}
    <div class="hint">Versão de demonstração: os dados ficam salvos neste navegador e o pagamento é simulado. As notificações push funcionam de verdade quando o servidor está configurado.</div>
    <div class="modal-actions wrap">${btn('Instalar aplicativo', 'install', 'secondary', 'download')}${btn('Restaurar demonstração', 'reset-review', 'danger')}</div>`);
}
function boardModal(id) {
  const b = getBoard(id);
  modal(esc(b.name), `<div class="board-stage tall">${boardImg(b)}</div>${detail('Tamanho', esc(b.size))}${detail('Volume', esc(b.volume))}${detail('Tipo', esc(b.type))}${detail('Indicada para', esc(b.level))}<p class="muted spacer">${esc(b.desc)}</p><div class="hint">A prancha é fornecida pela escola. O instrutor confirma a prancha de cada aula conforme o seu nível e as condições do mar.</div>`);
}
function placeModal(id) {
  const p = getPlace(id);
  modal(esc(p.name), `<img class="photo-wide" src="${esc(p.image)}" alt="${esc(p.name)}"><p>${esc(p.description)}</p>${priceTable(p).replace('<section class="card">', '<section class="spacer">')}<div class="hint"><strong>Ponto de encontro</strong><br>${esc(p.meeting)}</div>
    <div class="modal-actions wrap"><a class="btn secondary" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}" target="_blank" rel="noopener">Abrir mapa ${icon('pin')}</a>${role === 'student' ? btn('Agendar aqui', 'book-place:' + id, '', 'arrow') : ''}</div>`);
}
function noticesModal() {
  const list = myInbox();
  modal('Notificações', list.length ? `<div class="feed">${list.map(n => `<button type="button" class="feed-item ${n.read ? '' : 'unread'}" data-action="${n.booking && getBooking(n.booking) ? (role === 'admin' ? 'admin-booking:' : 'booking:') + n.booking : 'close'}"><strong>${esc(n.title)}</strong><small>${esc(n.body)}</small><em>${ago(n.at)}</em></button>`).join('')}</div>` : `<div class="empty">${icon('bell')}<h3>Tudo em dia.</h3><p>Avisos sobre ${role === 'admin' ? 'novos agendamentos' : 'suas aulas'} aparecem aqui.</p></div>`);
  list.forEach(n => { n.read = true; });
  save();
  setTimeout(render, 0);
}

/* =========================================================================
   Eventos
   ========================================================================= */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  if (el.tagName === 'A' && !el.dataset.action.startsWith('nav')) return;
  e.preventDefault();
  const raw = el.dataset.action, i = raw.indexOf(':'), a = i < 0 ? raw : raw.slice(0, i), id = i < 0 ? '' : raw.slice(i + 1);
  const [x, y, z] = id.split('|');
  switch (a) {
    case 'close': close(); break;
    case 'nav': close(); if (id !== 'book') reschedule = null; go(id); break;
    case 'role': close(); role = id; reschedule = null; page = 'home'; render(); window.scrollTo({ top: 0 }); break;
    case 'theme': theme = document.body.classList.contains('dark') ? 'light' : 'dark'; localStorage.setItem('outside-theme', theme); render(); break;
    case 'settings': settings(); break;
    case 'notices': noticesModal(); break;
    case 'tab': tab = id; render(); break;
    case 'req-tab': reqTab = id; render(); break;
    // agendamento do aluno
    case 'bk-place': bk = { ...bk, place: id, plan: 'single', orderId: null, people: 1, date: null, time: null }; render(); break;
    case 'bk-plan': bk.plan = id; bk.orderId = null; bk.time = null; render(); break;
    case 'bk-credit': bk.plan = 'credit'; bk.orderId = id; bk.people = 1; render(); break;
    case 'bk-people': bk.people = +id; bk.time = null; render(); break;
    case 'bk-week': bk.start = addDays(bk.start, +id); if (bk.start < today()) bk.start = today(); render(); break;
    case 'bk-date': bk.date = id; bk.time = null; render(); break;
    case 'bk-time': bk.time = id; render(); if (matchMedia('(max-width:980px)').matches) $('.summary')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); break;
    case 'bk-submit': await submitBooking(); break;
    case 'fc-spot': fcSpot = id; render(); break;
    case 'fc-date': fcDate = id; render(); break;
    case 'fc-open': close(); fcSpot = x; fcDate = y || today(); go('forecast'); break;
    case 'fc-refresh': state.places.forEach(pl => { fcLoading[pl.id] = true; Forecast.load(pl.id, true).finally(() => { fcLoading[pl.id] = false; if (page === 'forecast') render(); }); }); toast('Atualizando a previsão…'); break;
    case 'fc-book': reschedule = null; bk = { ...bk, place: x, plan: 'single', orderId: null, people: 1, date: y, time: z, start: y }; go('book'); break;
    case 'book-place': close(); bk = { ...bk, place: id, date: null, time: null }; go('book'); break;
    case 'stop-reschedule': reschedule = null; render(); break;
    case 'reschedule': { const b = getBooking(id); reschedule = id; close(); bk = { ...bk, place: b.place, date: null, time: null, start: today() }; go('book'); break; }
    case 'booking': bookingDetail(id); break;
    case 'success-lessons': close(); tab = 'upcoming'; go('lessons'); break;
    case 'board': boardModal(id); break;
    case 'place': placeModal(id); break;
    // pagamento
    case 'pay': close(); checkout(id); break;
    case 'pay-method': pay.method = id; pay.error = ''; renderCheckout(); break;
    case 'pix-paid': await processPayment('pix'); break;
    case 'copy-pix': { const v = $('#pix-code').value; try { await navigator.clipboard.writeText(v); } catch { $('#pix-code').select(); document.execCommand('copy'); } toast('Código Pix copiado!'); break; }
    // instrutor
    case 'push-enable': await enablePush(); break;
    case 'push-disable': await Push.disable(); toast('Notificações desativadas neste aparelho.'); refreshPushStatus(); break;
    case 'push-test': el.disabled = true; await testPush(); break;
    case 'admin-booking': adminBooking(id); break;
    case 'confirm-booking': confirmBooking(id); break;
    case 'decline': { const b = getBooking(id); modal(b.status === 'confirmed' ? 'Cancelar esta aula?' : 'Recusar este pedido?', `<form data-form="decline" data-id="${id}"><p>${esc(getStudent(b.student).name)} · ${fmtShort(b.date)} às ${b.time}. O aluno recebe um aviso${getOrder(b.orderId)?.plan === 'single' ? ' e o valor pago é estornado' : ' e o crédito volta para o pacote'}.</p><div class="field spacer"><label for="decline-reason">Mensagem para o aluno</label><textarea id="decline-reason" name="reason" required maxlength="400">${b.status === 'confirmed' ? 'Infelizmente as condições do mar não permitem a aula neste horário.' : 'Não consigo atender neste horário. Que tal escolher outro?'}</textarea></div><div class="modal-actions">${btn('Voltar', 'admin-booking:' + id, 'secondary')}<button class="btn danger" type="submit">${b.status === 'confirmed' ? 'Cancelar e avisar' : 'Recusar e avisar'}</button></div></form>`); break; }
    case 'attend': { const b = getBooking(x); b.status = y; b.history.push({ at: Date.now(), text: y === 'done' ? 'Aula realizada' : 'Aluno faltou' }); save(); close(); render(); toast(y === 'done' ? 'Aula registrada como realizada.' : 'Falta registrada.'); break; }
    case 'assign-board': { const b = getBooking(x), board = getBoard(y); b.board = y; inbox(b.student, 'Sua prancha foi definida', `Para a aula de ${fmtShort(b.date)} às ${b.time}: ${board.name} ${board.size}.`, b.id); save(); adminBooking(x); render(); toast(`${board.name} reservada para esta aula.`); break; }
    case 'receive': receive(x, y); break;
    case 'admin-move': { const b = getBooking(id); modal('Remarcar aula', `<form data-form="move" data-id="${id}"><div class="fields"><div class="field"><label for="mv-date">Nova data</label><input id="mv-date" name="date" type="date" min="${today()}" value="${b.date}" required></div><div class="field"><label for="mv-time">Horário</label><select id="mv-time" name="time" data-place="${b.place}" data-ignore="${b.id}">${timeOptions(b.place, b.date, b.time)}</select></div></div><p class="legal-note">Remarcações feitas por você não contam no limite do aluno.</p><div class="modal-actions"><button class="btn" type="submit">Remarcar e avisar ${icon('check')}</button></div></form>`); break; }
    case 'agenda-date': agendaDate = id; render(); break;
    case 'agenda-week': agendaStart = addDays(agendaStart, +id); agendaDate = agendaStart; render(); break;
    case 'agenda-today': agendaStart = agendaDate = today(); render(); break;
    case 'block-day': case 'block-slot': modal(a === 'block-day' ? 'Bloquear o dia' : 'Bloquear horário', `<form data-form="block" data-place="${x}" data-date="${y}" data-time="${z || ''}"><p>${esc(placeName(x))} · ${fmt(y, { weekday: 'long', day: 'numeric', month: 'long' })}${z ? ' · ' + z : ''}</p><div class="field spacer"><label for="block-reason">Motivo (opcional)</label><input id="block-reason" name="reason" maxlength="120" placeholder="Ex.: mar flat, compromisso pessoal"></div><div class="modal-actions"><button class="btn" type="submit">Bloquear ${icon('block')}</button></div></form>`); break;
    case 'unblock': state.blocks = state.blocks.filter(b => b.id !== id); save(); render(); toast('Horário liberado.'); break;
    case 'edit-tide': editTide(id); break;
    case 'reset-tide': delete state.tides[id]; save(); close(); render(); toast('Usando a estimativa de maré.'); break;
    case 'manual-booking': manualBooking({ place: x, date: y, time: z, student: el.dataset.student }); break;
    case 'edit-board': editBoard(id); break;
    case 'delete-board': if (state.boards.length <= 1) return toast('Mantenha ao menos uma prancha.'); modal('Remover prancha?', `<p>${esc(getBoard(id).name)} sai do quiver. Aulas com esta prancha ficam “a definir”.</p><div class="modal-actions">${btn('Voltar', 'edit-board:' + id, 'secondary')}${btn('Remover', 'delete-board-ok:' + id, 'danger', 'trash')}</div>`); break;
    case 'delete-board-ok': state.boards = state.boards.filter(b => b.id !== id); state.bookings.forEach(b => { if (b.board === id) b.board = null; }); state.students.forEach(s => { if (s.board === id) s.board = null; }); save(); close(); render(); toast('Prancha removida.'); break;
    case 'students': case 'student': close(); selectedStudent = id; go('student'); break;
    case 'edit-student': editStudent(id); break;
    case 'install': if (installPrompt) { await installPrompt.prompt(); installPrompt = null; } else modal('Leve a Outside com você.', `<p>Instale o app para receber notificações e abrir mais rápido.</p><div class="hint"><strong>iPhone / Safari</strong><br>Toque em Compartilhar e depois em “Adicionar à Tela de Início”.<br><br><strong>Android / Chrome</strong><br>Abra o menu e escolha “Instalar app”.</div>`); break;
    case 'reset-review': modal('Recomeçar a demonstração?', `<p>Reservas, pagamentos e pranchas deste navegador voltam aos exemplos iniciais.</p><div class="modal-actions">${btn('Voltar', 'close', 'secondary')}${btn('Restaurar dados', 'reset', 'danger')}</div>`); break;
    case 'reset': state = seed(); save(); close(); page = 'home'; render(); toast('Demonstração restaurada.'); break;
  }
});

document.addEventListener('change', async e => {
  const el = e.target;
  if (el.id === 'theme-choice') { theme = el.value; localStorage.setItem('outside-theme', theme); render(); }
  else if (el.name === 'pay-amount') { pay.amount = +el.value; renderCheckout(); }
  else if (el.dataset.toggleBoard) { const b = getBoard(el.dataset.toggleBoard); b.available = el.checked; save(); render(); toast(b.available ? `${b.name} liberada para os alunos.` : `${b.name} reservada só para você.`); }
  else if (el.id === 'board-photo' && el.files[0]) {
    $('#cut-msg').textContent = 'Abrindo a foto…';
    try { cut.img = await Cutout.loadImage(el.files[0]); $('#tol-field').hidden = false; await runCutout(); }
    catch (err) { $('#cut-msg').textContent = err.message; }
  }
  else if (el.id === 'cut-tol') { cut.tol = +el.value; runCutout(); }
  else if (el.id === 'mb-student') { $('#mb-new').hidden = el.value !== 'new'; }
  else if (el.id === 'mb-place' || el.id === 'mb-date') { if ($('#mb-date').value) $('#mb-time').innerHTML = timeOptions($('#mb-place').value, $('#mb-date').value); }
  else if (el.id === 'mv-date') { const t = $('#mv-time'); t.innerHTML = slotsFor(t.dataset.place, el.value, t.dataset.ignore).filter(s => !s.past && !s.block && s.free > 0).map(s => `<option value="${s.time}">${s.time}</option>`).join('') || '<option value="">Sem horários livres</option>'; }
  else if (el.closest('.hour')) el.closest('.hour').classList.toggle('active', el.checked);
});

document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'student-search') { const pos = el.selectionStart; studentFilter = el.value; render(); $('#student-search').focus(); $('#student-search').setSelectionRange(pos, pos); }
  else if (el.id === 'bk-companion') bk.companion = el.value;
  else if (el.id === 'cc-number') {
    const d = el.value.replace(/\D/g, '').slice(0, 19);
    el.value = d.replace(/(.{4})/g, '$1 ').trim();
    $('#card-num-preview').textContent = (d.padEnd(16, '•').match(/.{1,4}/g) || []).join(' ');
    $('#card-brand').textContent = cardBrand(d);
  }
  else if (el.id === 'cc-name') { el.value = el.value.toUpperCase(); $('#card-name-preview').textContent = el.value || 'NOME NO CARTÃO'; }
  else if (el.id === 'cc-exp') { const d = el.value.replace(/\D/g, '').slice(0, 4); el.value = d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d; }
  else if (el.id === 'cc-cvv') el.value = el.value.replace(/\D/g, '').slice(0, 4);
});

document.addEventListener('submit', async e => {
  const f = e.target;
  if (!f.dataset.form) return;
  e.preventDefault();
  const data = new FormData(f), v = Object.fromEntries(data), id = f.dataset.id, type = f.dataset.form;
  if (type === 'card') {
    const number = v.number.replace(/\D/g, ''), [mm, yy] = v.exp.split('/').map(Number), now = new Date();
    const expOk = mm >= 1 && mm <= 12 && yy >= 0 && new Date(2000 + yy, mm, 1) > now;
    pay.error = !luhn(number) ? 'Número de cartão inválido.' : !v.name.trim() ? 'Informe o nome impresso no cartão.' : !expOk ? 'Validade inválida ou vencida.' : !/^\d{3,4}$/.test(v.cvv) ? 'CVV inválido.' : '';
    if (pay.error) { renderCheckout(); return; }
    await processPayment('card', { last4: number.slice(-4), brand: cardBrand(number), installments: +v.installments || 1, declined: number.endsWith('0002') });
    return;
  }
  if (type === 'student') {
    const s = id === 'new' ? { id: uid(), notes: [], shared: [], level: levels[0], board: null } : getStudent(id);
    if (role !== 'admin' && s.id !== me().id) return;
    s.name = v.name.trim(); s.email = (v.email || '').trim(); s.phone = (v.phone || '').trim();
    if (role === 'admin') { s.level = v.level; s.board = v.board; }
    if (id === 'new') state.students.push(s);
    save(); close(); render(); toast('Dados salvos.');
    return;
  }
  if (role !== 'admin') return;
  switch (type) {
    case 'note': {
      if (!v.text.trim()) return;
      const s = getStudent(f.dataset.student), shared = f.dataset.visibility === 'shared';
      s[shared ? 'shared' : 'notes'].push({ text: v.text.trim(), date: today() });
      if (shared) inbox(s.id, 'Nova dica do instrutor', v.text.trim().slice(0, 140));
      save(); render(); toast(shared ? 'Orientação enviada ao aluno.' : 'Anotação salva.');
      return;
    }
    case 'decline': declineBooking(id, v.reason.trim()); return;
    case 'board': {
      if (!cut.dataUrl) { $('#cut-msg').textContent = 'Tire ou escolha uma foto da prancha.'; return; }
      const b = id === 'new' ? { id: uid() } : getBoard(id);
      Object.assign(b, { name: v.name.trim(), size: v.size.trim(), volume: v.volume.trim() || '—', type: v.type, level: v.level, desc: v.desc.trim(), condition: v.condition, available: !!v.available && v.condition === 'ok', image: cut.dataUrl });
      if (id === 'new') state.boards.push(b);
      save(); close(); render(); toast(id === 'new' ? `${b.name} entrou no quiver!` : 'Prancha atualizada.');
      return;
    }
    case 'block':
      state.blocks.push({ id: uid(), place: f.dataset.place, date: f.dataset.date, time: f.dataset.time || null, reason: v.reason.trim() });
      save(); close(); render(); toast('Bloqueado. Alunos não verão este horário.');
      return;
    case 'tide': {
      const hours = data.getAll('hours').sort();
      if (!hours.length) { toast('Marque pelo menos um horário ou bloqueie o dia.'); return; }
      const conflict = state.bookings.find(b => b.place === 'farol' && b.date === f.dataset.date && isLive(b) && !hours.includes(b.time));
      if (conflict) { toast(`Há uma reserva às ${conflict.time}. Remarque-a antes de remover este horário.`); return; }
      state.tides[f.dataset.date] = { period: +hours[0].slice(0, 2) < 12 ? 'manhã' : 'tarde', hours, estimated: false };
      save(); close(); render(); toast('Horários do Farol atualizados.');
      return;
    }
    case 'move': {
      const b = getBooking(id);
      if (!v.time) { toast('Escolha um horário livre.'); return; }
      const from = `${fmtShort(b.date)} ${b.time}`;
      Object.assign(b, { date: v.date, time: v.time });
      b.history.push({ at: Date.now(), text: `Remarcada pelo instrutor de ${from} para ${fmtShort(v.date)} ${v.time}` });
      inbox(b.student, 'Aula remarcada', `${S().instructor.split(' ')[0]} remarcou sua aula para ${fmtShort(v.date)} às ${v.time} em ${placeName(b.place)}.`, b.id);
      save(); close(); render(); toast('Aula remarcada e aluno avisado.');
      return;
    }
    case 'manual': {
      let sid = v.student;
      if (sid === 'new') {
        if (!v.name.trim()) { toast('Informe o nome do aluno.'); return; }
        const s = { id: uid(), name: v.name.trim(), email: '', phone: v.phone.trim(), level: 'Primeiro contato', board: null, notes: [], shared: [] };
        state.students.push(s); sid = s.id;
      }
      const p = getPlace(v.place), people = p.capacity > 1 ? +v.people : 1;
      if (!v.time) { toast('Escolha um horário livre.'); return; }
      if (occupancy(p.id, v.date, v.time) + people > p.capacity) { toast('Não há vagas suficientes neste horário.'); return; }
      let order;
      if (v.plan === 'credit') {
        order = activePackages(sid, p.id)[0];
        if (!order) { toast('Este aluno não tem pacote ativo neste local.'); return; }
      } else {
        const total = v.plan === 'single' ? p.prices.single * people : p.prices[v.plan];
        order = { id: uid(), code: shortCode(), student: sid, place: p.id, plan: v.plan, people: v.plan === 'single' ? people : 1, companion: '', total, paid: 0, createdAt: Date.now(), expiresAt: PLANS[v.plan].validity ? addDays(today(), PLANS[v.plan].validity) : null, status: 'pending' };
        const amount = v.paid === 'full' ? total : v.paid === 'deposit' ? deposit(order) : 0;
        if (amount) { order.paid = amount; state.payments.push({ id: uid(), orderId: order.id, student: sid, amount, method: 'pix', kind: amount >= total ? 'integral' : 'sinal', status: 'paid', at: Date.now(), txid: 'PIX-MANUAL' }); }
        order.status = order.paid >= total ? 'paid' : order.paid ? 'active' : 'pending';
        state.orders.push(order);
      }
      const b = { id: uid(), code: shortCode(), orderId: order.id, student: sid, place: p.id, date: v.date, time: v.time, people: order.people, status: 'confirmed', board: suggestBoard(getStudent(sid)), rescheduled: 0, createdAt: Date.now(), history: [{ at: Date.now(), text: 'Agendada pelo instrutor' }] };
      state.bookings.push(b);
      inbox(sid, 'Aula agendada', `${S().instructor.split(' ')[0]} agendou sua aula para ${fmtShort(b.date)} às ${b.time} em ${p.short}.`, b.id);
      agendaDate = b.date;
      save(); close(); render(); toast('Aula agendada e confirmada.');
      return;
    }
    case 'prices': {
      for (const p of state.places) for (const k of Object.keys(PLANS)) p.prices[k] = Math.max(1, +v[`${p.id}.${k}`] || p.prices[k]);
      S().depositPct = Math.min(100, Math.max(10, +v.depositPct || 50));
      save(); render(); toast('Valores atualizados.');
      return;
    }
    case 'settings': {
      Object.assign(S(), { school: v.school.trim(), instructor: v.instructor.trim(), phone: v.phone.replace(/\D/g, ''), pixKey: Pix.phoneKey(v.phone), pixName: v.pixName.trim(), holdMinutes: Math.max(5, +v.holdMinutes || 30), autoConfirm: !!v.autoConfirm });
      save(); close(); render(); toast('Configurações salvas.');
      return;
    }
  }
});

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; });
window.addEventListener('online', render);
window.addEventListener('offline', render);
window.addEventListener('storage', e => {
  if (e.key !== STORE_KEY) return;
  try { state = JSON.parse(e.newValue) || seed(); if (!$('#modal').open) render(); } catch { /* ignora */ }
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (theme === 'system') render(); });
$('#modal').addEventListener('click', e => {
  if (e.target !== $('#modal')) return;
  const r = $('#modal').getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close();
});
$('#modal').addEventListener('close', () => { if (!$('#modal').open) { stopPixTimer(); pay = null; } });

// Abrir direto pela notificação: ?admin=1&booking=ID
function openFromUrl(url) {
  const q = new URL(url, location.href).searchParams;
  if (q.get('admin')) { role = 'admin'; page = q.get('booking') ? 'requests' : 'home'; }
  render();
  if (q.get('booking') && getBooking(q.get('booking'))) adminBooking(q.get('booking'));
}
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', e => { if (e.data?.type === 'open') openFromUrl(e.data.url); });
}
save();
openFromUrl(location.href);
state.places.forEach(p => ensureForecast(p.id));
if (location.search) history.replaceState(null, '', location.pathname);
setInterval(() => { const before = JSON.stringify(state.bookings.map(b => b.status)); sweep(); if (JSON.stringify(state.bookings.map(b => b.status)) !== before && !$('#modal').open) render(); }, 30000);
