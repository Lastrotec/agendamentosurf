// Rotas abertas (sem login): configuração pública, horários livres, previsão e políticas. Sem dados pessoais.
import { Hono } from 'hono';
import { z } from 'zod';

import { DEFAULT_PRIVACY, DEFAULT_TERMS } from '../../shared/legal';
import { dateStr, placeId } from '../../shared/schemas';
import { addDays } from '../../shared/time';
import { cachedResponse } from '../lib/edge-cache';
import { parseQuery } from '../lib/http';
import { availability, today } from '../services/bookings';
import { readForecast } from '../services/forecast';
import { pushPublicKey } from '../services/notify';
import { getPlace, loadPlaces, publicConfig, toBoard, toPlace, type BoardRow } from '../services/settings';
import type { AppEnv } from '../types';

export const publicRoutes = new Hono<AppEnv>();

publicRoutes.get('/bootstrap', (c) =>
  cachedResponse(c, '/__cache/bootstrap', 30, async () => {
    const sql = c.get('db')();
    const s = await c.get('settings')();
    const places = await loadPlaces(sql);
    // Quiver desligado: as pranchas nem saem do servidor (o aluno não sabe que a função existe).
    const boards = s.quiver_enabled
      ? (await sql<BoardRow[]>`select * from boards where available and condition = 'ok' order by sort, name`).map(toBoard)
      : [];
    return c.json({ config: publicConfig(s), places: places.map(toPlace), boards, today: today(), pushKey: pushPublicKey(c.env) });
  }),
);

const availQuery = z.object({ place: placeId, from: dateStr, days: z.coerce.number().int().min(1).max(31).default(14) });

publicRoutes.get('/availability', async (c) => {
  const q = parseQuery(c, availQuery);
  const sql = c.get('db')();
  const s = await c.get('settings')();
  const place = await getPlace(sql, q.place);
  const from = q.from < today() ? today() : q.from;
  const days = await availability(sql, s, place, from, Math.min(q.days, Math.max(1, s.horizon_days + 1)));
  return c.json({ place: place.id, days, until: addDays(today(), s.horizon_days) });
});

publicRoutes.get('/forecast/:place', (c) => {
  const id = c.req.param('place');
  if (!/^[a-z0-9-]{2,30}$/.test(id)) return c.json({ error: 'Local inválido.' }, 400);
  return cachedResponse(c, `/__cache/forecast/${id}`, 900, async () => {
    const sql = c.get('db')();
    const place = await getPlace(sql, id);
    return c.json({ place: id, ...(await readForecast(sql, place)) });
  });
});

publicRoutes.get('/legal', (c) =>
  cachedResponse(c, '/__cache/legal', 300, async () => {
    const s = await c.get('settings')();
    return c.json({ privacyPolicy: s.privacy_policy || DEFAULT_PRIVACY(s.school, s.instructor), terms: s.terms || DEFAULT_TERMS(s.school), updatedAt: new Date(s.updated_at).toISOString() });
  }),
);
