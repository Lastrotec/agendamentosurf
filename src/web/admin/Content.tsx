// Textos, fotos e política de privacidade editáveis pelo Romário (sem precisar de programador).
import { useEffect, useState } from 'react';

import { IMAGE_SLOTS, type ImageSlot, imageUrl, TEXT_FIELDS, type TextKey } from '../../shared/domain';
import { Icon } from '../components/icons';
import { Btn, PageTitle, Spinner, useToast } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { useApi } from '../lib/hooks';
import { kb, uploadPhoto } from '../lib/image';
import { useTitle } from '../lib/router';
import type { Place } from '../lib/types';

interface SettingsResp {
  texts: Record<string, string>;
  images: Record<string, string>;
  privacyPolicy: string;
  terms: string;
}

function PhotoSlot({ label, current, fallback, maxSide, onSaved }: { label: string; current: string | null; fallback: string | null; maxSide: number; onSaved: (id: string | null) => Promise<void> }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const src = imageUrl(current, fallback);
  return (
    <div className="img-slot">
      {src ? <img src={src} alt="" /> : <div className="ph"><Icon name="image" /></div>}
      <div>
        <strong>{label}</strong>
        <p className="legal-note">A foto é reduzida e comprimida no celular antes de subir (fica leve sem perder a nitidez).</p>
        <div className="row wrap spacer-sm">
          <label className={`btn secondary small file-btn ${busy ? 'disabled' : ''}`}>
            {busy ? <span className="spinner sm" /> : <Icon name="upload" />}Trocar foto
            <input type="file" accept="image/*" disabled={busy} onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              setBusy(true);
              try {
                const up = await uploadPhoto(f, maxSide);
                await onSaved(up.id);
                toast(`Foto atualizada (${kb(up.bytes)}).`);
              } catch (err) {
                toast(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }} />
          </label>
          {current && <Btn small variant="subtle" onClick={() => onSaved(null)}>Voltar à padrão</Btn>}
        </div>
      </div>
    </div>
  );
}

export function ContentPage() {
  useTitle('Textos e fotos');
  const toast = useToast();
  const { data, reload } = useApi<SettingsResp>('/api/admin/settings');
  const { data: places, reload: reloadPlaces } = useApi<{ places: (Place & { waveFactor: number; active: boolean })[] }>('/api/admin/places');
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [legal, setLegal] = useState({ privacyPolicy: '', terms: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!data) return;
    setTexts(Object.fromEntries((Object.keys(TEXT_FIELDS) as TextKey[]).map((k) => [k, data.texts[k] ?? ''])));
    setLegal({ privacyPolicy: data.privacyPolicy, terms: data.terms });
  }, [data]);
  if (!data || !places) return <Spinner />;
  const saveTexts = async () => {
    setBusy(true);
    try {
      await api('/api/admin/texts', { method: 'PUT', body: texts });
      toast('Textos publicados no app.');
      reload();
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page-content">
      <PageTitle title="Textos e fotos." sub="O que você mudar aqui aparece no app dos alunos em segundos." />
      <section className="card">
        <h3>Fotos</h3>
        {(Object.keys(IMAGE_SLOTS) as ImageSlot[]).map((k) => (
          <PhotoSlot key={k} label={IMAGE_SLOTS[k].label} current={data.images[k] ?? null} fallback={IMAGE_SLOTS[k].fallback} maxSide={IMAGE_SLOTS[k].maxSide} onSaved={async (id) => (await api('/api/admin/images', { method: 'PUT', body: { slot: k, imageId: id } }), reload())} />
        ))}
        {places.places.map((p) => (
          <PhotoSlot
            key={p.id}
            label={`Foto de ${p.name}`}
            current={p.imageId}
            fallback={p.id === 'farol' ? '/img/coast.jpg' : '/img/beach.jpg'}
            maxSide={1400}
            onSaved={async (id) => {
              const { id: _id, facing: _f, ...rest } = p;
              void _id;
              void _f;
              await api(`/api/admin/places/${p.id}`, { method: 'PUT', body: { ...rest, imageId: id } });
              reloadPlaces();
            }}
          />
        ))}
      </section>
      <section className="card spacer">
        <h3>Textos do app</h3>
        <p className="legal-note">Deixe um campo vazio para voltar ao texto padrão. Só texto (sem formatação).</p>
        <div className="form-grid spacer">
          {(Object.keys(TEXT_FIELDS) as TextKey[]).map((k) => {
            const f = TEXT_FIELDS[k];
            const long = f.max > 160;
            return (
              <div key={k} className={`field ${long ? 'full' : ''}`}>
                <label htmlFor={`t-${k}`}>{f.label}</label>
                {long ? <textarea id={`t-${k}`} rows={4} maxLength={f.max} value={texts[k] ?? ''} placeholder={f.default} onChange={(e) => setTexts({ ...texts, [k]: e.target.value })} /> : <input id={`t-${k}`} maxLength={f.max} value={texts[k] ?? ''} placeholder={f.default} onChange={(e) => setTexts({ ...texts, [k]: e.target.value })} />}
                <small className="help">{(texts[k] ?? '').length}/{f.max}</small>
              </div>
            );
          })}
        </div>
        <div className="modal-actions"><Btn icon="check" busy={busy} onClick={saveTexts}>Publicar textos</Btn></div>
      </section>
      <section className="card spacer">
        <h3>Política de privacidade e termos</h3>
        <p className="legal-note">Já vem com um texto padrão adequado à LGPD. Ajuste se precisar (por exemplo, com orientação de um advogado).</p>
        <div className="field spacer"><label htmlFor="pp">Política de privacidade</label><textarea id="pp" rows={14} maxLength={20000} value={legal.privacyPolicy} onChange={(e) => setLegal({ ...legal, privacyPolicy: e.target.value })} /></div>
        <div className="field"><label htmlFor="tt">Termos de uso e responsabilidade</label><textarea id="tt" rows={10} maxLength={20000} value={legal.terms} onChange={(e) => setLegal({ ...legal, terms: e.target.value })} /></div>
        <div className="modal-actions">
          <a className="btn secondary" href="/privacidade" target="_blank" rel="noopener">Ver no app <Icon name="eye" /></a>
          <Btn icon="check" onClick={async () => { try { await api('/api/admin/legal', { method: 'PUT', body: legal }); toast('Política publicada.'); } catch (e) { toast(errorMessage(e)); } }}>Publicar</Btn>
        </div>
      </section>
    </div>
  );
}
