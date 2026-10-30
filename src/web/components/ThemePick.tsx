// Escolha de tema com prévia em miniatura (primeira configuração e Ajustes → Aparência).
import { type ThemePref } from '../lib/theme';
import { Icon } from './icons';

const OPTIONS: { value: Exclude<ThemePref, 'system'>; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
];

export function ThemePick({ value, onChange }: { value: ThemePref | null; onChange: (v: ThemePref) => void }) {
  return (
    <div className="theme-pick" role="group" aria-label="Tema do app">
      {OPTIONS.map((o) => (
        <button key={o.value} type="button" className="theme-opt" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          <div className={`theme-mock ${o.value}`} aria-hidden="true">
            <i className="t" />
            <i style={{ width: '80%' }} />
            <b />
            <u />
            <s />
          </div>
          <span>
            {o.label}
            {value === o.value && <Icon name="check" />}
          </span>
        </button>
      ))}
    </div>
  );
}
