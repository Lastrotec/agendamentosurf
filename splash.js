'use strict';
// Abertura animada: uma onda com espuma sobe e cobre a logo da Outside.
// Aparece uma vez por sessão; toque/clique pula a animação.
(() => {
  let seen = null;
  try { seen = sessionStorage.getItem('outside-splash'); sessionStorage.setItem('outside-splash', '1'); } catch { /* sem storage */ }
  if (seen) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Gera um pseudo-aleatório estável para a espuma ficar sempre igual.
  let s = 7;
  const rand = () => (s = (s * 9301 + 49297) % 233280) / 233280;

  // Crista com "bolhas": arcos sucessivos sobre uma senoide. O desenho se repete
  // duas vezes na largura para o deslize horizontal ficar contínuo.
  function crest(width, base, amp, bubbly) {
    const half = width / 2, pts = [];
    for (let x = 0; x <= half; x += bubbly ? 16 + rand() * 18 : 60) pts.push(x);
    pts[pts.length - 1] = half;
    const y = x => base + Math.sin(x / half * Math.PI * 4) * amp + (bubbly && x > 0 && x < half ? -rand() * 7 : 0);
    const ys = pts.map(y);
    let d = `M0 ${ys[0].toFixed(1)}`;
    for (const off of [0, half]) {
      for (let i = 1; i < pts.length; i++) {
        const x = pts[i] + off, py = ys[i];
        if (bubbly) { const r = (pts[i] - pts[i - 1]) * 0.62; d += ` A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x.toFixed(1)} ${py.toFixed(1)}`; }
        else { const cx = (pts[i - 1] + pts[i]) / 2 + off; d += ` Q${cx.toFixed(1)} ${(py - amp * 0.9).toFixed(1)} ${x.toFixed(1)} ${py.toFixed(1)}`; }
      }
    }
    return d + ` V200 H0 Z`;
  }

  const layer = (cls, color, base, amp, foam) => `<div class="sp-layer ${cls}"><svg viewBox="0 0 2880 200" preserveAspectRatio="none" aria-hidden="true">
      ${foam ? `<path d="${crest(2880, base - 30, amp * 1.2, true)}" fill="#fff" opacity=".55"/><path d="${crest(2880, base - 14, amp, true)}" fill="#fff" opacity=".97"/><path d="${crest(2880, base + 6, amp * 0.8, true)}" fill="#dff6f2"/>` : ''}
      <path d="${crest(2880, base + (foam ? 26 : 0), amp, false)}" fill="${color}"/></svg><div class="sp-fill" style="background:${color}"></div></div>`;

  const bubbles = Array.from({ length: 26 }, (_, i) => {
    const size = 4 + rand() * 12;
    return `<i style="left:${(rand() * 100).toFixed(1)}%;width:${size.toFixed(0)}px;height:${size.toFixed(0)}px;animation-delay:${(1.25 + rand() * 0.8).toFixed(2)}s;--drift:${(rand() * 40 - 20).toFixed(0)}px"></i>`;
  }).join('');

  const el = document.createElement('div');
  el.id = 'splash';
  el.setAttribute('aria-hidden', 'true');
  el.className = reduce ? 'reduce' : '';
  el.innerHTML = `
    <div class="sp-logo">
      <svg viewBox="0 0 60 70"><path d="M3 40c12-2 9-21 22-29 9-6 19-6 28-1-18 4-17 17-12 24 3 4 7 5 13 6v4H3z"/><path class="sp-line" d="M3 54q5-8 10 0t10 0 10 0 10 0 10 0" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>
      <div class="sp-name">outside<small>SURF SCHOOL</small></div>
    </div>
    <div class="sp-sea">
      ${layer('l3', '#0b3f45', 70, 18, false)}
      ${layer('l2', '#0f5e5b', 80, 14, false)}
      ${layer('l1', '#1f8f8a', 90, 12, true)}
      <div class="sp-bubbles">${bubbles}</div>
    </div>`;
  document.body.appendChild(el);
  document.documentElement.classList.add('splashing');

  const finish = () => {
    if (el.classList.contains('out')) return;
    el.classList.add('out');
    document.documentElement.classList.remove('splashing');
    setTimeout(() => el.remove(), 650);
  };
  el.addEventListener('click', finish);
  setTimeout(finish, reduce ? 700 : 3000);
})();
