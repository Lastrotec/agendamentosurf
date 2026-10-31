// Tema claro/escuro, guardado por aparelho. O app do aluno segue o sistema até a pessoa escolher na
// primeira configuração; o painel do instrutor começa sempre no claro (pode trocar em Ajustes → Aparência).
// public/splash.js repete esta regra antes da primeira pintura, para não piscar o tema errado.
import { useCallback, useEffect, useState } from 'react';

import { safeStorage } from './hooks';

export type ThemePref = 'light' | 'dark' | 'system';
type Scope = 'student' | 'admin';

const KEYS: Record<Scope, string> = { student: 'outside-theme', admin: 'outside-theme-painel' };
const DEFAULTS: Record<Scope, ThemePref> = { student: 'system', admin: 'light' };
export const THEME_COLORS = { light: '#f7f8f5', dark: '#101210' };

const scopeOf = (path = location.pathname): Scope => (path === '/painel' || path.startsWith('/painel/') ? 'admin' : 'student');
const systemDark = () => matchMedia('(prefers-color-scheme: dark)').matches;
const valid = (v: string | null): v is ThemePref => v === 'light' || v === 'dark' || v === 'system';

export function getThemePref(scope = scopeOf()): ThemePref {
  const v = safeStorage.get('local', KEYS[scope]);
  return valid(v) ? v : DEFAULTS[scope];
}
/** A pessoa já escolheu um tema neste aparelho? */
export const hasChosenTheme = (scope = scopeOf()) => valid(safeStorage.get('local', KEYS[scope]));

const subs = new Set<() => void>();

export function applyTheme(pref = getThemePref()): boolean {
  const dark = pref === 'dark' || (pref === 'system' && systemDark());
  document.body.classList.toggle('dark', dark);
  document.documentElement.classList.toggle('dark', dark);
  if (!document.documentElement.classList.contains('splashing')) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? THEME_COLORS.dark : THEME_COLORS.light);
  return dark;
}

export function setThemePref(pref: ThemePref, scope = scopeOf()) {
  safeStorage.set('local', KEYS[scope], pref);
  applyTheme(pref);
  subs.forEach((s) => s());
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(() => getThemePref());
  const [dark, setDark] = useState(() => applyTheme(pref));
  useEffect(() => {
    const m = matchMedia('(prefers-color-scheme: dark)');
    const sync = () => {
      const p = getThemePref();
      setPref(p);
      setDark(applyTheme(p));
    };
    subs.add(sync);
    m.addEventListener('change', sync);
    return () => (subs.delete(sync), m.removeEventListener('change', sync));
  }, []);
  const toggle = useCallback(() => setThemePref(document.body.classList.contains('dark') ? 'light' : 'dark'), []);
  return { dark, pref, toggle, setPref: setThemePref };
}
