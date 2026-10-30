// Fotos do painel: reduzidas e comprimidas no próprio aparelho antes de subir (WebP ~82%),
// para o banco gratuito durar. Lado maior de até 1800 px: nítido em qualquer celular.
import { api } from './api';

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => (URL.revokeObjectURL(url), resolve(img));
    img.onerror = () => (URL.revokeObjectURL(url), reject(new Error('Não foi possível abrir a foto.')));
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, q: number): Promise<Blob | null> {
  return new Promise((r) => canvas.toBlob(r, type, q));
}

async function encode(canvas: HTMLCanvasElement, alpha: boolean): Promise<{ blob: Blob; mime: string }> {
  // WebP quando o navegador sabe gerar; senão JPEG (foto) ou PNG (recorte com transparência).
  for (const q of [0.82, 0.72, 0.6]) {
    const webp = await toBlob(canvas, 'image/webp', q);
    if (webp && webp.type === 'image/webp') {
      if (webp.size <= 880_000) return { blob: webp, mime: 'image/webp' };
      continue;
    }
    const fallback = await toBlob(canvas, alpha ? 'image/png' : 'image/jpeg', q);
    if (fallback && fallback.size <= 880_000) return { blob: fallback, mime: fallback.type };
  }
  throw new Error('A foto ficou grande demais. Tente outra com menos detalhes.');
}

export function drawScaled(src: CanvasImageSource, width: number, height: number, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const c = document.createElement('canvas');
  c.width = Math.round(width * scale);
  c.height = Math.round(height * scale);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

async function blobToB64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Comprime e envia. Devolve o id da imagem no banco e o tamanho final (para mostrar ao instrutor). */
export async function uploadCanvas(canvas: HTMLCanvasElement, alpha = false): Promise<{ id: string; bytes: number }> {
  const { blob, mime } = await encode(canvas, alpha);
  const r = await api<{ id: string }>('/api/admin/images', { body: { data: await blobToB64(blob), mime, width: canvas.width, height: canvas.height } });
  return { id: r.id, bytes: blob.size };
}

export async function uploadPhoto(file: File, maxSide = 1800) {
  if (!/^image\//.test(file.type)) throw new Error('Escolha um arquivo de imagem.');
  const img = await loadImage(file);
  return uploadCanvas(drawScaled(img, img.naturalWidth, img.naturalHeight, maxSide));
}

/**
 * Recorte automático do fundo da prancha (flood fill a partir das bordas, contorno suavizado),
 * girando para ficar em pé. Melhor com foto em fundo liso e contrastante.
 */
export function cutoutBoard(img: HTMLImageElement, tolerance = 28): HTMLCanvasElement {
  const MAX = 1400, OUT_H = 900;
  const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h), px = data.data;
  const median = (v: number[]) => v.sort((a, b) => a - b)[v.length >> 1];
  const r: number[] = [], g: number[] = [], b: number[] = [];
  const sample = (i: number) => (r.push(px[i]), g.push(px[i + 1]), b.push(px[i + 2]));
  for (let x = 0; x < w; x += 2) (sample(x * 4), sample(((h - 1) * w + x) * 4));
  for (let y = 0; y < h; y += 2) (sample(y * w * 4), sample((y * w + w - 1) * 4));
  const bg = [median(r), median(g), median(b)];
  const near = (i: number) => Math.max(Math.abs(px[i] - bg[0]), Math.abs(px[i + 1] - bg[1]), Math.abs(px[i + 2] - bg[2])) <= tolerance;
  const background = new Uint8Array(w * h), stack = new Int32Array(w * h);
  let top = 0;
  const seed = (p: number) => {
    if (!background[p] && near(p * 4)) (background[p] = 1, (stack[top++] = p));
  };
  for (let x = 0; x < w; x++) (seed(x), seed((h - 1) * w + x));
  for (let y = 0; y < h; y++) (seed(y * w), seed(y * w + w - 1));
  while (top) {
    const p = stack[--top], x = p % w;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (p >= w) seed(p - w);
    if (p < w * (h - 1)) seed(p + w);
  }
  const alpha = new Uint8ClampedArray(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (background[p]) continue;
      const edge = background[p - 1] + background[p + 1] + background[p - w] + background[p + w];
      alpha[p] = edge >= 2 ? 0 : edge === 1 ? 150 : 255;
    }
  const soft = new Uint8ClampedArray(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      soft[p] = (alpha[p] * 4 + alpha[p - 1] + alpha[p + 1] + alpha[p - w] + alpha[p + w]) / 8;
    }
  const cols = new Uint32Array(w), rows = new Uint32Array(h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (soft[y * w + x] > 128) (cols[x]++, rows[y]++);
  const minCol = h * 0.01, minRow = w * 0.01;
  let x0 = cols.findIndex((c) => c > minCol), x1 = w - 1 - [...cols].reverse().findIndex((c) => c > minCol);
  let y0 = rows.findIndex((c) => c > minRow), y1 = h - 1 - [...rows].reverse().findIndex((c) => c > minRow);
  if (x0 < 0 || y0 < 0 || x1 - x0 < 10 || y1 - y0 < 10) throw new Error('Não encontramos a prancha. Tente uma foto com fundo liso e contrastante.');
  for (let p = 0; p < w * h; p++) px[p * 4 + 3] = soft[p];
  ctx.putImageData(data, 0, 0);
  const pad = 6;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad);
  y1 = Math.min(h - 1, y1 + pad);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, rotate = cw > ch;
  const outW = Math.round((rotate ? ch / cw : cw / ch) * OUT_H);
  const out = document.createElement('canvas');
  out.width = outW;
  out.height = OUT_H;
  const o = out.getContext('2d')!;
  o.imageSmoothingQuality = 'high';
  if (rotate) {
    o.translate(outW, 0);
    o.rotate(Math.PI / 2);
    o.drawImage(canvas, x0, y0, cw, ch, 0, 0, OUT_H, outW);
  } else o.drawImage(canvas, x0, y0, cw, ch, 0, 0, outW, OUT_H);
  return out;
}

export const kb = (n: number) => `${Math.round(n / 1024)} KB`;
