import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/** Emite /sw.js com uma versão derivada dos arquivos do build (muda a cada deploy com mudanças). */
function serviceWorker(): Plugin {
  return {
    name: 'outside-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const hash = createHash('sha256').update(Object.keys(bundle).sort().join('|')).digest('hex').slice(0, 12);
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
