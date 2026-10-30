import type { Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/worker/app';
import { expireHolds } from '../../src/worker/services/bookings';
import { ADMIN, Client, idem, makeEnv, newPhone, nextClassDay, resetDb, setupAdmin } from './helpers';

let sql: Sql;
const app = createApp();
let env: ReturnType<typeof makeEnv>;

beforeAll(async () => {
  sql = await resetDb();
  await setupAdmin(sql);
  env = makeEnv(sql);
});
afterAll(async () => {
  await sql.end();
});

async function student(name = 'Camila Rocha') {
  const c = new Client(app, env);
  const phone = newPhone();
  const r = await c.post('/api/me/auth/signup', { name, phone, password: 'onda-boa-77', consent: true });
  expect(r.status, JSON.stringify(r.json)).toBe(201);
  return { c, phone };
}

async function admin() {
  const c = new Client(app, env);
  const r = await c.post('/api/admin/auth/login', ADMIN);
  expect(r.status).toBe(200);
  return c;
}

describe('público', () => {
  it('bootstrap sem dados pessoais e sem quiver quando desligado', async () => {
    const c = new Client(app, env);
    const r = await c.get('/api/public/bootstrap');
    expect(r.status).toBe(200);
    expect(r.json.places.map((p: { id: string }) => p.id)).toEqual(['jaguaribe', 'farol']);
    expect(r.json.config.quiverEnabled).toBe(false);
    expect(r.json.boards).toEqual([]);
    expect(r.json.config.texts.heroTitle).toContain('mar');
    expect(JSON.stringify(r.json)).not.toContain('pix_key');
  });

  it('horários: Jaguaribe fixo, Farol pela maré, sem aula às terças', async () => {
    const c = new Client(app, env);
    const from = nextClassDay(3);
    const j = await c.get(`/api/public/availability?place=jaguaribe&from=${from}&days=7`);
    expect(j.status).toBe(200);
    const tue = j.json.days.find((d: { date: string }) => new Date(d.date + 'T12:00:00Z').getUTCDay() === 2);
    expect(tue.slots).toEqual([]);
    const open = j.json.days.find((d: { open: boolean }) => d.open);
    expect(open.slots.map((s: { time: string }) => s.time)).toEqual(['06:00', '07:00', '08:00', '09:00', '10:00', '11:00']);
    const f = await c.get(`/api/public/availability?place=farol&from=${from}&days=3`);
    const fd = f.json.days.find((d: { open: boolean }) => d.open);
    expect(fd.slots).toHaveLength(3);
    expect(fd.tide.source).toBe('estimativa');
  });

  it('política de privacidade padrão', async () => {
    const r = await new Client(app, env).get('/api/public/legal');
    expect(r.json.privacyPolicy).toContain('LGPD');
  });
});

describe('cadastro e acesso', () => {
  it('cadastro exige consentimento, celular válido e senha razoável', async () => {
    const c = new Client(app, env);
    expect((await c.post('/api/me/auth/signup', { name: 'Ana', phone: newPhone(), password: 'onda-boa-77' })).status).toBe(400);
    expect((await c.post('/api/me/auth/signup', { name: 'Ana', phone: '123', password: 'onda-boa-77', consent: true })).status).toBe(400);
    expect((await c.post('/api/me/auth/signup', { name: 'Ana', phone: newPhone(), password: '123456', consent: true })).json.code).toBe('WEAK_PASSWORD');
  });

  it('sanitiza o nome (sem HTML) e não deixa cadastrar o mesmo número duas vezes', async () => {
    const c = new Client(app, env);
    const phone = newPhone();
    const r = await c.post('/api/me/auth/signup', { name: '<script>alert(1)</script>João   <b>Vitor</b>', phone, password: 'onda-boa-77', consent: true });
    expect(r.status).toBe(201);
    const me = await c.get('/api/me');
    expect(me.json.profile.name).toBe('alert(1)João Vitor');
    const again = await new Client(app, env).post('/api/me/auth/signup', { name: 'Outro', phone, password: 'onda-boa-77', consent: true });
    expect(again.json.code).toBe('PHONE_EXISTS');
  });

  it('login com celular + senha e erro genérico', async () => {
    const { phone } = await student();
    const c = new Client(app, env);
    expect((await c.post('/api/me/auth/login', { phone, password: 'errada-123' })).status).toBe(401);
    expect((await c.post('/api/me/auth/login', { phone, password: 'onda-boa-77' })).status).toBe(200);
    expect((await c.get('/api/me')).status).toBe(200);
    expect((await new Client(app, env).get('/api/me')).status).toBe(401);
  });

  it('esqueci a senha: código gerado pelo instrutor', async () => {
    const { c: s, phone } = await student('Pedro Almeida');
    const a = await admin();
    const list = await a.get('/api/admin/students?q=pedro');
    const id = list.json.students[0].id;
    const { json } = await a.post(`/api/admin/students/${id}/reset-code`);
    expect(json.code).toMatch(/^\d{6}$/);
    const c = new Client(app, env);
    expect((await c.post('/api/me/auth/reset', { phone, code: '000000', password: 'nova-senha-9' })).status).toBe(400);
    expect((await c.post('/api/me/auth/reset', { phone, code: json.code, password: 'nova-senha-9' })).status).toBe(200);
    expect((await s.get('/api/me')).status).toBe(401); // sessões antigas encerradas
  });

  it('CSRF: mutação sem cabeçalho próprio é bloqueada', async () => {
    const c = new Client(app, env);
    const r = await c.req('POST', '/api/me/auth/login', { phone: newPhone(), password: 'x' }, { 'x-requested-with': 'nao' });
    expect(r.status).toBe(403);
  });
});

describe('agendamento, Pix e confirmação', () => {
  it('reserva → aluno avisa o Pix → instrutor confere → confirmada', async () => {
    const { c } = await student('Marina Costa');
    const date = nextClassDay(3);
    const r = await c.post('/api/me/bookings', { place: 'jaguaribe', plan: 'single', people: 1, date, time: '08:00', idempotencyKey: idem() });
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    expect(r.json.booking.status).toBe('pending_payment');
    expect(r.json.order.depositCents).toBe(7500);
    expect(r.json.pix.options[0].cents).toBe(7500);
    expect(r.json.pix.options[0].payload).toMatch(/^000201.*5405 ?75\.00|^000201/);
    expect(r.json.pix.options[0].payload).toContain('540575.00');

    // A vaga some para os outros.
    const av = await c.get(`/api/public/availability?place=jaguaribe&from=${date}&days=1`);
    expect(av.json.days[0].slots.find((s: { time: string }) => s.time === '08:00').free).toBe(0);

    expect((await c.post(`/api/me/orders/${r.json.order.id}/pix-sent`, { cents: 7500 })).status).toBe(200);
    // Mesmo vencendo o prazo, o horário não expira depois do aviso de Pix.
    await sql`update bookings set hold_until = now() - interval '1 minute' where id = ${r.json.booking.id}`;
    await expireHolds(sql);

    const a = await admin();
    const dash = await a.get('/api/admin/dashboard');
    expect(dash.json.pending.map((b: { id: string }) => b.id)).toContain(r.json.booking.id);
    expect((await a.post(`/api/admin/orders/${r.json.order.id}/payments`, { amountCents: 7500, method: 'pix' })).status).toBe(200);
    const me = await c.get('/api/me');
    const b = me.json.bookings.find((x: { id: string }) => x.id === r.json.booking.id);
    expect(b.status).toBe('confirmed');
    expect(me.json.orders[0].paidCents).toBe(7500);
    expect(me.json.inbox[0].title).toContain('confirmada');
  });

  it('idempotência: duplo toque cria um pedido só', async () => {
    const { c } = await student();
    const key = idem();
    const body = { place: 'jaguaribe', plan: 'single', people: 1, date: nextClassDay(4), time: '09:00', idempotencyKey: key };
    const [a, b] = await Promise.all([c.post('/api/me/bookings', body), c.post('/api/me/bookings', body)]);
    expect([a.status, b.status].sort()).toEqual([200, 201].sort());
  });

  it('reserva sem pagamento expira e libera a vaga', async () => {
    const { c } = await student();
    const date = nextClassDay(5);
    const r = await c.post('/api/me/bookings', { place: 'jaguaribe', plan: 'single', people: 1, date, time: '10:00', idempotencyKey: idem() });
    await sql`update bookings set hold_until = now() - interval '1 minute' where id = ${r.json.booking.id}`;
    expect(await expireHolds(sql)).toBeGreaterThan(0);
    const av = await c.get(`/api/public/availability?place=jaguaribe&from=${date}&days=1`);
    expect(av.json.days[0].slots.find((s: { time: string }) => s.time === '10:00').free).toBe(1);
  });

  it('concorrência: Farol com 2 vagas aceita só 2 reservas simultâneas', async () => {
    const date = nextClassDay(6);
    const av = await new Client(app, env).get(`/api/public/availability?place=farol&from=${date}&days=1`);
    const time = av.json.days[0].slots[0].time;
    const students = await Promise.all(Array.from({ length: 6 }, (_, i) => student(`Aluno ${i}`)));
    const results = await Promise.all(students.map(({ c }) => c.post('/api/me/bookings', { place: 'farol', plan: 'single', people: 1, date, time, idempotencyKey: idem() })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(2);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
  });

  it('dupla exige o nome do acompanhante e cobra por pessoa', async () => {
    const { c } = await student();
    const date = nextClassDay(7);
    const av = await c.get(`/api/public/availability?place=farol&from=${date}&days=1`);
    const time = av.json.days[0].slots[1].time;
    expect((await c.post('/api/me/bookings', { place: 'farol', plan: 'single', people: 2, date, time, idempotencyKey: idem() })).status).toBe(400);
    const r = await c.post('/api/me/bookings', { place: 'farol', plan: 'single', people: 2, companion: 'Rafael', date, time, idempotencyKey: idem() });
    expect(r.json.order.totalCents).toBe(40000);
  });
});

describe('cancelamento e reembolso', () => {
  it('aluno cancela dentro do prazo → valor fica a devolver → instrutor marca devolvido', async () => {
    const { c } = await student('Beatriz');
    const r = await c.post('/api/me/bookings', { place: 'jaguaribe', plan: 'single', people: 1, date: nextClassDay(8), time: '07:00', idempotencyKey: idem() });
    const a = await admin();
    await a.post(`/api/admin/orders/${r.json.order.id}/payments`, { amountCents: 15000, method: 'pix' });
    const cancel = await c.post(`/api/me/bookings/${r.json.booking.id}/cancel`);
    expect(cancel.json.refundCents).toBe(15000);
    const fin = await a.get('/api/admin/finance');
    expect(fin.json.open.some((o: { id: string; refundDueCents: number }) => o.id === r.json.order.id && o.refundDueCents === 15000)).toBe(true);
    expect((await a.post(`/api/admin/orders/${r.json.order.id}/refunded`, { method: 'pix' })).status).toBe(200);
    const me = await c.get('/api/me');
    expect(me.json.orders.find((o: { id: string }) => o.id === r.json.order.id).refundedCents).toBe(15000);
  });

  it('fora do prazo definido pelo instrutor, o app não deixa cancelar', async () => {
    await sql`update settings set cancel_limit_hours = 720`;
    const { c } = await student();
    const r = await c.post('/api/me/bookings', { place: 'jaguaribe', plan: 'single', people: 1, date: nextClassDay(3), time: '11:00', idempotencyKey: idem() });
    const a = await admin();
    await a.post(`/api/admin/orders/${r.json.order.id}/payments`, { amountCents: 7500, method: 'pix' });
    const res = await c.post(`/api/me/bookings/${r.json.booking.id}/cancel`);
    expect(res.json.code).toBe('CANCEL_WINDOW');
    await sql`update settings set cancel_limit_hours = 24`;
  });

  it('pacote: crédito usado, cancelado volta para o pacote', async () => {
    const { c } = await student('Lucas');
    const d1 = nextClassDay(9);
    const r = await c.post('/api/me/bookings', { place: 'jaguaribe', plan: 'pack5', people: 1, date: d1, time: '06:00', idempotencyKey: idem() });
    expect(r.json.order.depositCents).toBe(35000);
    const a = await admin();
    await a.post(`/api/admin/orders/${r.json.order.id}/payments`, { amountCents: 35000, method: 'pix' });
    const d2 = nextClassDay(10);
    const credit = await c.post('/api/me/bookings', { place: 'jaguaribe', plan: 'credit', orderId: r.json.order.id, people: 1, date: d2, time: '06:00', idempotencyKey: idem() });
    expect(credit.status, JSON.stringify(credit.json)).toBe(201);
    expect(credit.json.booking.status).toBe('awaiting');
    let me = await c.get('/api/me');
    expect(me.json.orders.find((o: { id: string }) => o.id === r.json.order.id).used).toBe(2);
    await c.post(`/api/me/bookings/${credit.json.booking.id}/cancel`);
    me = await c.get('/api/me');
    expect(me.json.orders.find((o: { id: string }) => o.id === r.json.order.id).used).toBe(1);
    expect(me.json.orders.find((o: { id: string }) => o.id === r.json.order.id).refundDueCents).toBe(0);
  });

  it('remarcação limitada a 1 vez', async () => {
    const { c } = await student();
    const r = await c.post('/api/me/bookings', { place: 'jaguaribe', plan: 'single', people: 1, date: nextClassDay(11), time: '09:00', idempotencyKey: idem() });
    const a = await admin();
    await a.post(`/api/admin/orders/${r.json.order.id}/payments`, { amountCents: 7500, method: 'pix' });
    const m1 = await c.post(`/api/me/bookings/${r.json.booking.id}/reschedule`, { date: nextClassDay(12), time: '10:00' });
    expect(m1.status, JSON.stringify(m1.json)).toBe(200);
    const m2 = await c.post(`/api/me/bookings/${r.json.booking.id}/reschedule`, { date: nextClassDay(13), time: '10:00' });
    expect(m2.json.code).toBe('RESCHEDULE_LIMIT');
  });
});

describe('painel', () => {
  it('rotas do painel exigem login do instrutor (aluno não entra)', async () => {
    const { c } = await student();
    expect((await c.get('/api/admin/dashboard')).status).toBe(401);
  });

  it('quiver: só aparece para o aluno quando o instrutor ativa', async () => {
    const a = await admin();
    const b = await a.post('/api/admin/boards', { name: 'Longboard Azul', size: "9'2", volume: '78 L', type: 'Longboard', level: 'Iniciante', description: 'Estável', imageId: null, available: true, condition: 'ok' });
    expect(b.status).toBe(201);
    let boot = await new Client(app, env).get('/api/public/bootstrap');
    expect(boot.json.boards).toEqual([]);
    const s = (await a.get('/api/admin/settings')).json.settings;
    expect((await a.put('/api/admin/settings', { ...s, whatsapp: '71992208398', quiverEnabled: true })).status).toBe(200);
    boot = await new Client(app, env).get('/api/public/bootstrap');
    expect(boot.json.config.quiverEnabled).toBe(true);
    expect(boot.json.boards).toHaveLength(1);
  });

  it('textos editáveis são sanitizados e vazio volta ao padrão', async () => {
    const a = await admin();
    const cur = (await a.get('/api/public/bootstrap')).json.config.texts;
    const r = await a.put('/api/admin/texts', { ...cur, heroTitle: '<img src=x onerror=alert(1)>Mar <b>bom</b>', quote: '' });
    expect(r.status).toBe(200);
    const boot = await new Client(app, env).get('/api/public/bootstrap');
    expect(boot.json.config.texts.heroTitle).toBe('Mar bom');
    expect(boot.json.config.texts.quote).toContain('mar ensina');
  });

  it('imagem: confere o tipo real pelos bytes e serve pelo hash', async () => {
    const a = await admin();
    const fake = await a.post('/api/admin/images', { data: Buffer.from('<svg onload=alert(1)>'.repeat(20)).toString('base64'), mime: 'image/png', width: 10, height: 10 });
    expect(fake.status).toBe(400);
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 1)]);
    const ok = await a.post('/api/admin/images', { data: png.toString('base64'), mime: 'image/png', width: 10, height: 10 });
    expect(ok.status).toBe(201);
    expect(ok.json.id).toMatch(/^[a-f0-9]{24}$/);
    expect((await a.put('/api/admin/images', { slot: 'hero', imageId: ok.json.id })).status).toBe(200);
    const boot = await new Client(app, env).get('/api/public/bootstrap');
    expect(boot.json.config.images.hero).toBe(ok.json.id);
  });

  it('agendamento manual + presença + agenda', async () => {
    const a = await admin();
    const date = nextClassDay(14);
    const r = await a.post('/api/admin/bookings', { newStudent: { name: 'Rafael Lima', phone: newPhone() }, place: 'jaguaribe', plan: 'single', people: 1, date, time: '06:00', paid: 'full', method: 'cash' });
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    const ag = await a.get(`/api/admin/agenda?from=${date}&days=1`);
    expect(ag.json.bookings.some((b: { id: string }) => b.id === r.json.booking.id)).toBe(true);
    // Presença só depois do início
    expect((await a.post(`/api/admin/bookings/${r.json.booking.id}/attend`, { status: 'done' })).status).toBe(409);
  });

  it('LGPD: aluno apaga a própria conta', async () => {
    const { c, phone } = await student('Apagar Eu');
    expect((await c.post('/api/me/delete')).status).toBe(200);
    expect((await new Client(app, env).post('/api/me/auth/login', { phone, password: 'onda-boa-77' })).status).toBe(401);
  });
});
