'use strict';
// Recorte automático de fundo para fotos de pranchas, 100% no navegador.
// Estima a cor do fundo pelas bordas da foto, preenche a partir das bordas
// tudo o que for parecido (flood fill), suaviza o contorno e recorta a prancha.
const Cutout = (() => {
  const MAX_SIDE = 1400, OUT_HEIGHT = 720;

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível abrir a foto.')); };
      img.src = url;
    });
  }

  function median(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    return sorted[sorted.length >> 1];
  }

  function process(img, tolerance = 28) {
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h), px = data.data;

    // Cor de fundo: mediana dos pixels da borda.
    const r = [], g = [], b = [];
    const sample = i => { r.push(px[i]); g.push(px[i + 1]); b.push(px[i + 2]); };
    for (let x = 0; x < w; x += 2) { sample(x * 4); sample(((h - 1) * w + x) * 4); }
    for (let y = 0; y < h; y += 2) { sample(y * w * 4); sample((y * w + w - 1) * 4); }
    const bg = [median(r), median(g), median(b)];

    const near = i => Math.max(Math.abs(px[i] - bg[0]), Math.abs(px[i + 1] - bg[1]), Math.abs(px[i + 2] - bg[2])) <= tolerance;
    const background = new Uint8Array(w * h), stack = new Int32Array(w * h);
    let top = 0;
    const seed = p => { if (!background[p] && near(p * 4)) { background[p] = 1; stack[top++] = p; } };
    for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
    while (top) {
      const p = stack[--top], x = p % w;
      if (x > 0) seed(p - 1);
      if (x < w - 1) seed(p + 1);
      if (p >= w) seed(p - w);
      if (p < w * (h - 1)) seed(p + w);
    }

    // Alpha com contorno levemente erodido e suavizado.
    const alpha = new Uint8ClampedArray(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (background[p]) continue;
      const edge = background[p - 1] + background[p + 1] + background[p - w] + background[p + w];
      alpha[p] = edge >= 2 ? 0 : edge === 1 ? 150 : 255;
    }
    const soft = new Uint8ClampedArray(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      soft[p] = (alpha[p] * 4 + alpha[p - 1] + alpha[p + 1] + alpha[p - w] + alpha[p + w]) / 8;
    }

    // Caixa da prancha: ignora ruído pequeno usando contagens por linha/coluna.
    const cols = new Uint32Array(w), rows = new Uint32Array(h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (soft[y * w + x] > 128) { cols[x]++; rows[y]++; }
    const minCol = h * 0.01, minRow = w * 0.01;
    let x0 = cols.findIndex(c => c > minCol), x1 = w - 1 - [...cols].reverse().findIndex(c => c > minCol);
    let y0 = rows.findIndex(c => c > minRow), y1 = h - 1 - [...rows].reverse().findIndex(c => c > minRow);
    if (x0 < 0 || y0 < 0 || x1 - x0 < 10 || y1 - y0 < 10) throw new Error('Não encontramos a prancha. Tente uma foto com fundo liso e contrastante.');
    const coverage = (x1 - x0) * (y1 - y0) / (w * h);

    for (let p = 0; p < w * h; p++) px[p * 4 + 3] = soft[p];
    ctx.putImageData(data, 0, 0);

    const pad = 6;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1, rotate = cw > ch;
    const outH = OUT_HEIGHT, outW = Math.round((rotate ? ch / cw : cw / ch) * outH);
    const out = document.createElement('canvas');
    out.width = outW; out.height = outH;
    const octx = out.getContext('2d');
    octx.imageSmoothingQuality = 'high';
    if (rotate) {
      // Prancha fotografada deitada: gira para ficar em pé (bico para cima).
      octx.translate(outW, 0);
      octx.rotate(Math.PI / 2);
      octx.drawImage(canvas, x0, y0, cw, ch, 0, 0, outH, outW);
    } else {
      octx.drawImage(canvas, x0, y0, cw, ch, 0, 0, outW, outH);
    }
    return { dataUrl: out.toDataURL('image/png'), coverage, background: `rgb(${bg.join(',')})` };
  }

  return { loadImage, process };
})();
