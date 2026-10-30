'use strict';
// Roda antes da primeira pintura (script síncrono no início do <body>):
//  1. aplica o tema salvo neste aparelho — sem piscar o tema errado (mesma regra de src/web/lib/theme.ts);
//  2. abertura animada: a onda sobe, cobre a logo da Outside (laranja → branca) e se abre para o app.
//     Uma vez por sessão, no app do aluno e no painel. Toque para pular. Som opcional (botão "Som").
(() => {
  const html = document.documentElement;
  const admin = location.pathname === '/painel' || location.pathname.startsWith('/painel/');
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } return null; };

  // --- 1. Tema ---
  let pref = store(admin ? 'outside-theme-painel' : 'outside-theme');
  if (pref !== 'light' && pref !== 'dark' && pref !== 'system') pref = admin ? 'light' : 'system';
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  html.classList.toggle('dark', dark);
  document.body.classList.toggle('dark', dark);
  const bar = document.querySelector('meta[name="theme-color"]');
  const setBar = (c) => { if (bar) bar.setAttribute('content', c); };
  const BG = dark ? '#101210' : '#f7f8f5';
  setBar(BG);

  // --- 2. Abertura ---
  let seen = null;
  try { seen = sessionStorage.getItem('outside-splash'); sessionStorage.setItem('outside-splash', '1'); } catch { /* sem storage: mostra */ }
  if (seen) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Crista suave (senoide) repetida duas vezes na largura: o deslize horizontal fica contínuo.
  const crest = (base, amp, waves) => {
    const W = 1440, half = W / 2, step = half / (waves * 8);
    let d = `M0 ${base}`;
    for (let x = step; x <= W + 0.1; x += step) d += ` L${x.toFixed(1)} ${(base - Math.sin((x / half) * Math.PI * 2 * waves) * amp).toFixed(1)}`;
    return `${d} V240 H0 Z`;
  };
  const layer = (cls, fill, base, amp, waves, foam) =>
    `<div class="sp-layer ${cls}"><svg viewBox="0 0 1440 240" preserveAspectRatio="none" aria-hidden="true">` +
    (foam ? `<path d="${crest(base - 6, amp, waves)}" fill="#ffffff" opacity=".9"/>` : '') +
    `<path d="${crest(base, amp, waves)}" fill="${fill}"/></svg><div class="sp-fill" style="background:${fill}"></div></div>`;

  const el = document.createElement('div');
  el.id = 'splash';
  el.setAttribute('aria-hidden', 'true');
  el.className = (reduce ? 'reduce ' : '') + (dark ? 'dark' : '');
  el.innerHTML =
    `<div class="sp-logo"><img class="sp-mark" src="/brand/logo.svg" alt="" decoding="sync"><img class="sp-mark white" src="/brand/logo.svg" alt="" decoding="sync">` +
    (admin ? '<small class="sp-tag">PAINEL DO INSTRUTOR</small>' : '') + `</div>` +
    (reduce ? '' : `<div class="sp-sea">${layer('l3', '#0b3f45', 70, 14, 2, false)}${layer('l2', '#12605c', 80, 11, 3, false)}${layer('l1', '#1f8f8a', 90, 9, 2, true)}</div>`) +
    `<button type="button" class="sp-sound" aria-pressed="false" aria-label="Som da abertura"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path class="w" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/><path class="x" d="m16 9 6 6m0-6-6 6"/></svg><span>Som</span></button>`;
  document.body.appendChild(el);
  html.classList.add('splashing');

  // --- Som da onda (opcional): ruído filtrado gerado aqui mesmo, sem arquivo. Navegadores só liberam
  // áudio depois de um toque: com a preferência ligada tentamos, e se o navegador bloquear seguimos em silêncio.
  const btn = el.querySelector('.sp-sound');
  let ctx = null, started = 0;
  const wantSound = store('outside-splash-sound') === '1';
  const playWave = () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = ctx || new AC();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const t0 = ctx.currentTime, len = 3.2, sr = ctx.sampleRate;
      const buf = ctx.createBuffer(1, Math.floor(sr * len), sr), data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; data[i] = last * 3.2; }
      const src = ctx.createBufferSource(); src.buffer = buf;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      const g = ctx.createGain();
      // Offset: se o som foi ligado no meio da animação, acompanha a onda de onde ela está.
      const off = Math.min(1.6, Math.max(0, (performance.now() - started) / 1000));
      lp.frequency.setValueAtTime(380, t0);
      lp.frequency.linearRampToValueAtTime(1500, t0 + Math.max(0.05, 1.5 - off));
      lp.frequency.linearRampToValueAtTime(420, t0 + Math.max(0.1, 3 - off));
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.32, t0 + Math.max(0.05, 1.4 - off));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.2, 3.1 - off));
      src.connect(lp).connect(g).connect(ctx.destination);
      src.start(t0, 0, len);
    } catch { /* sem áudio */ }
  };
  const setBtn = (on) => { btn.setAttribute('aria-pressed', String(on)); btn.classList.toggle('on', on); };
  setBtn(wantSound);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const on = btn.getAttribute('aria-pressed') !== 'true';
    store('outside-splash-sound', on ? '1' : '0');
    setBtn(on);
    if (on) playWave(); else if (ctx) ctx.close().catch(() => {}), (ctx = null);
  });

  // Começa depois do primeiro quadro pintado (e da logo pronta), para não "pular" o início.
  const go = () => {
    if (el.classList.contains('go')) return;
    started = performance.now();
    el.classList.add('go');
    if (wantSound && !reduce) playWave();
    if (!reduce) setTimeout(() => { if (!el.classList.contains('out')) setBar('#1f8f8a'); }, 1500);
    setTimeout(finish, reduce ? 900 : 2900);
  };
  const img = el.querySelector('.sp-mark');
  const ready = () => requestAnimationFrame(() => requestAnimationFrame(go));
  if (img.complete) ready(); else { img.addEventListener('load', ready, { once: true }); img.addEventListener('error', ready, { once: true }); setTimeout(ready, 600); }

  function finish() {
    if (el.classList.contains('out')) return;
    el.classList.add('out');
    html.classList.remove('splashing');
    setBar(BG);
    setTimeout(() => { el.remove(); if (ctx) setTimeout(() => ctx && ctx.close().catch(() => {}), 1500); }, 700);
  }
  el.addEventListener('click', finish);
  setTimeout(finish, 6000); // segurança: nunca prende a tela
})();
