import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/** Conteúdo de public/ (abertura, logo, ícones, manifestos): também entra na versão do app. */
function publicFiles(dir = 'public'): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? publicFiles(p) : [p];
  });
}

/**
 * Emite /sw.js com uma versão derivada do build e de public/: qualquer mudança (inclusive só na abertura,
 * na logo ou nos ícones) gera versão nova, e o app instalado troca o cache antigo.
 */
function serviceWorker(): Plugin {
  return {
    name: 'outside-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const h = createHash('sha256').update(Object.keys(bundle).sort().join('|'));
      for (const f of publicFiles().sort()) h.update(f).update(readFileSync(f));
      h.update(readFileSync('src/sw/sw.js'));
      const hash = h.digest('hex').slice(0, 12);
      const src = readFileSync('src/sw/sw.js', 'utf8').replace("'__VERSION__'", `'${hash}'`);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: src });
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  build: { outDir: 'dist', assetsDir: 'assets', sourcemap: false, target: 'es2020' },
  server: { port: 5173, proxy: { '/api': 'http://localhost:8788', '/img': 'http://localhost:8788', '/health': 'http://localhost:8788' } },
});
