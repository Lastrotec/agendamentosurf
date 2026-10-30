// Tema claro/escuro: segue o sistema até a pessoa escolher (preferência guardada só neste aparelho).
import { useCallback, useEffect, useState } from 'react';

import { safeStorage } from './hooks';

const KEY = 'outside-theme';
const systemDark = () => matchMedia('(prefers-color-scheme: dark)').matches;

export function applyTheme(pref = safeStorage.get('local', KEY) ?? 'system') {
  const dark = pref === 'dark' || (pref === 'system' && systemDark());
  document.body.classList.toggle('dark', dark);
  if (!document.documentElement.classList.contains('splashing')) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#101210' : '#f7f8f5');
  return dark;
}

export function useTheme() {
  const [dark, setDark] = useState(() => applyTheme());
  useEffect(() => {
    const m = matchMedia('(prefers-color-scheme: dark)');
    const on = () => setDark(applyTheme());
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  const toggle = useCallback(() => {
    const next = document.body.classList.contains('dark') ? 'light' : 'dark';
    safeStorage.set('local', KEY, next);
    setDark(applyTheme(next));
  }, []);
  return { dark, toggle };
}
