// Estado do app do aluno: configuração pública + dados do aluno logado.
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { api, ApiError, cachedGet, clearApiMemo } from '../lib/api';
import type { Bootstrap, Me } from '../lib/types';

interface Store {
  boot: Bootstrap;
  me: Me | null;
  meLoading: boolean;
  reloadMe: () => Promise<void>;
  logout: () => Promise<void>;
  /** Abre o cadastro/login e, ao entrar, continua o que a pessoa estava fazendo. */
  requireLogin: (then?: () => void) => void;
  authOpen: { then?: () => void } | null;
  closeAuth: () => void;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => useContext(Ctx)!;

export function StoreProvider({ boot, children }: { boot: Bootstrap; children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState<{ then?: () => void } | null>(null);
  const reloadMe = useCallback(async () => {
    try {
      setMe(await cachedGet<Me>('/api/me', true));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setMe(null);
    } finally {
      setMeLoading(false);
    }
  }, []);
  useEffect(() => {
    void reloadMe();
    // Atualiza ao voltar para o app (sem ficar consultando o servidor o tempo todo).
    const on = () => document.visibilityState === 'visible' && void reloadMe();
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, [reloadMe]);
  const logout = useCallback(async () => {
    await api('/api/me/auth/logout', { body: {} }).catch(() => {});
    clearApiMemo();
    setMe(null);
  }, []);
  const requireLogin = useCallback((then?: () => void) => {
    if (me) then?.();
    else setAuthOpen({ then });
  }, [me]);
  return (
    <Ctx.Provider value={{ boot, me, meLoading, reloadMe, logout, requireLogin, authOpen, closeAuth: () => setAuthOpen(null) }}>{children}</Ctx.Provider>
  );
}

export const placeOf = (boot: Bootstrap, id: string) => boot.places.find((p) => p.id === id);
