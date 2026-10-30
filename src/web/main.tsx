import './surf.css';
import './app.css';
import './refine.css';

import { lazy, StrictMode, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { ToastProvider } from './components/ui';
import { usePath } from './lib/router';
import { applyTheme } from './lib/theme';
import { registerServiceWorker } from './pwa/pwa';
import { StudentApp } from './student/StudentApp';

// O painel é carregado só por quem abre /painel: o app do aluno fica leve.
const AdminApp = lazy(() => import('./admin/AdminApp'));

let applyUpdate: (() => void) | null = null;
const updateSubs = new Set<() => void>();
registerServiceWorker((apply) => {
  applyUpdate = apply;
  updateSubs.forEach((s) => s());
});

function UpdateBanner() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((x) => x + 1);
    updateSubs.add(f);
    return () => void updateSubs.delete(f);
  }, []);
  if (!applyUpdate) return null;
  return (
    <div role="status" className="update-banner">
      Nova versão disponível.
      <button type="button" className="btn small" onClick={() => applyUpdate?.()}>Atualizar</button>
    </div>
  );
}

function Root() {
  const path = usePath();
  const admin = path === '/painel' || path.startsWith('/painel/');
  return (
    <ToastProvider>
      <UpdateBanner />
      {admin ? (
        <Suspense fallback={null}>
          <AdminApp />
        </Suspense>
      ) : (
        <StudentApp />
      )}
    </ToastProvider>
  );
}

applyTheme();

// iPhone (app instalado, iOS 26): a janela às vezes termina antes da borda de baixo da tela e a barra
// inferior ficava "flutuando" acima de uma faixa vazia. Detectamos a diferença e a barra se ajusta.
function detectBottomGap() {
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const portrait = innerHeight > innerWidth;
  const gap = screen.height - innerHeight;
  document.documentElement.classList.toggle('ios-gap', standalone && portrait && /iPhone|iPod/.test(navigator.userAgent) && gap > 20 && gap < 90);
}
detectBottomGap();
addEventListener('resize', detectBottomGap);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
