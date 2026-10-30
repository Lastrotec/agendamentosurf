// Cadastro em 1 tela (nome, celular e senha) + entrar + "esqueci a senha" com código do instrutor.
import { useState } from 'react';

import { maskPhoneInput } from '../../shared/phone';
import { Icon } from '../components/icons';
import { Logo } from '../components/Logo';
import { Btn, Modal } from '../components/ui';
import { api, clearApiMemo, errorMessage } from '../lib/api';
import { whatsappLink } from '../lib/format';
import { Link } from '../lib/router';
import { useStore } from './store';

type Mode = 'signup' | 'login' | 'reset';

export function AuthModal() {
  const { boot, authOpen, closeAuth, reloadMe } = useStore();
  const [mode, setMode] = useState<Mode>('signup');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [consent, setConsent] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!authOpen) return null;
  const cfg = boot.config;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (mode === 'signup' && !consent) return setError('Aceite a política de privacidade para continuar.');
    setBusy(true);
    try {
      const website = (new FormData(e.currentTarget).get('website') as string) || undefined;
      if (mode === 'signup') await api('/api/me/auth/signup', { body: { name, phone, password, consent: true, website } });
      else if (mode === 'login') await api('/api/me/auth/login', { body: { phone, password } });
      else await api('/api/me/auth/reset', { body: { phone, code, password } });
      clearApiMemo();
      await reloadMe();
      const then = authOpen.then;
      closeAuth();
      then?.();
    } catch (err) {
      setError(errorMessage(err));
      if ((err as { code?: string }).code === 'PHONE_EXISTS') setMode('login');
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'signup' ? 'Crie sua conta em segundos' : mode === 'login' ? 'Que bom te ver de novo' : 'Criar uma senha nova';
  return (
    <Modal title={title} onClose={closeAuth} className="auth-modal">
      <div className="auth-logo"><Logo height={110} /></div>
      <div className="tabs">
        <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => (setMode('signup'), setError(null))}>Criar conta</button>
        <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => (setMode('login'), setError(null))}>Já tenho conta</button>
      </div>
      <form onSubmit={submit} className="auth-form" noValidate>
        {mode === 'signup' && (
          <div className="field">
            <label htmlFor="a-name">Seu nome</label>
            <input id="a-name" autoComplete="name" maxLength={60} required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome e sobrenome" />
          </div>
        )}
        <div className="field">
          <label htmlFor="a-phone">Celular com DDD (WhatsApp)</label>
          <input id="a-phone" type="tel" inputMode="numeric" autoComplete="tel-national" required value={phone} onChange={(e) => setPhone(maskPhoneInput(e.target.value))} placeholder="(71) 99999-9999" />
        </div>
        {mode === 'reset' && (
          <div className="field">
            <label htmlFor="a-code">Código de 6 dígitos (enviado pelo instrutor)</label>
            <input id="a-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
          </div>
        )}
        <div className="field">
          <label htmlFor="a-pass">{mode === 'login' ? 'Senha' : 'Crie uma senha (mín. 6 caracteres)'}</label>
          <div className="copy-row">
            <input id="a-pass" type={show ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={6} maxLength={200} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="btn secondary" aria-label={show ? 'Esconder senha' : 'Mostrar senha'} onClick={() => setShow(!show)}><Icon name="eye" /></button>
          </div>
        </div>
        {/* Armadilha para robôs: invisível para pessoas. */}
        <input name="website" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
        {mode === 'signup' && (
          <>
            <label className="check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>Li e aceito a <Link to="/privacidade" className="link" onClick={closeAuth}>política de privacidade e os termos</Link>.</span>
            </label>
            <p className="legal-note"><Icon name="lock" /> {cfg.texts.signupNote}</p>
          </>
        )}
        {error && <div className="notice warn" role="alert"><Icon name="info" /><p>{error}</p></div>}
        <Btn type="submit" full busy={busy} icon="arrow">{mode === 'signup' ? 'Criar conta' : mode === 'login' ? 'Entrar' : 'Salvar senha e entrar'}</Btn>
        {mode === 'login' && (
          <button type="button" className="text-btn center" onClick={() => setMode('reset')}>Esqueci a senha</button>
        )}
        {mode === 'reset' && (
          <p className="legal-note">
            Peça um código ao instrutor:{' '}
            <a className="link" href={whatsappLink(cfg.whatsapp, 'Olá! Esqueci minha senha do app da Outside. Pode me mandar um código?')} target="_blank" rel="noopener noreferrer">
              chamar no WhatsApp
            </a>
            .
          </p>
        )}
      </form>
    </Modal>
  );
}
