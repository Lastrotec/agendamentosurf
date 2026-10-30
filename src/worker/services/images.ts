// Imagens enviadas pelo painel: já chegam comprimidas pelo aparelho (WebP, lado máx. 1800 px).
// O servidor confere o tipo real pelos bytes, guarda pelo hash (sem duplicar) e serve com cache eterno.
import type { Sql } from 'postgres';

import { b64urlToBytes } from '../lib/crypto';
import { badRequest } from '../lib/errors';

function sniff(b: Uint8Array): string | null {
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  return null;
}

export async function saveImage(sql: Sql, input: { data: string; mime: string; width: number; height: number }): Promise<string> {
  let bytes: Uint8Array;
  try {
    bytes = b64urlToBytes(input.data.replace(/^data:[^,]+,/, '').replace(/=+$/, ''));
  } catch {
    throw badRequest('Imagem inválida.');
  }
  if (bytes.length < 100) throw badRequest('Imagem inválida.');
  if (bytes.length > 900_000) throw badRequest('Imagem muito grande depois da compressão. Tente outra foto.');
  const real = sniff(bytes);
  if (!real || real !== input.mime) throw badRequest('Formato de imagem não aceito (use foto JPG, PNG ou WebP).');
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource));
  const id = [...digest.slice(0, 12)].map((x) => x.toString(16).padStart(2, '0')).join('');
  await sql`insert into images (id, mime, bytes, width, height) values (${id}, ${real}, ${bytes}, ${input.width}, ${input.height}) on conflict (id) do nothing`;
  return id;
}

/** Apaga imagens que nenhum lugar usa mais (limpeza diária). */
export async function deleteUnusedImages(sql: Sql): Promise<number> {
  const r = await sql`
    delete from images i where i.created_at < now() - interval '1 day'
      and not exists (select 1 from boards b where b.image_id = i.id)
      and not exists (select 1 from places p where p.image_id = i.id)
      and not exists (select 1 from settings s, jsonb_each_text(s.images) e where e.value = i.id)
    returning id`;
  return r.length;
}
