// Quiver (opcional): o Romário liga quando quiser. Desligado, o aluno nem sabe que existe.
import { useEffect, useRef, useState } from 'react';

import { BOARD_TYPES, imageUrl, LEVELS } from '../../shared/domain';
import { Icon } from '../components/icons';
import { Btn, Empty, Modal, PageTitle, Spinner, useToast } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { useApi } from '../lib/hooks';
import { cutoutBoard, drawScaled, kb, loadImage, uploadCanvas } from '../lib/image';
import { useTitle } from '../lib/router';
import type { Board } from '../lib/types';

type Draft = Omit<Board, 'id'> & { id?: string };
const EMPTY: Draft = { name: '', size: '', volume: '', type: 'Longboard', level: 'Iniciante', description: '', imageId: null, available: true, condition: 'ok' };

function BoardEditor({ initial, onClose, onDone }: { initial: Draft; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [b, setB] = useState<Draft>(initial);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [tol, setTol] = useState(28);
  const [cut, setCut] = useState(true);
  const [preview, setPreview] = useState<string | null>(initial.imageId ? imageUrl(initial.imageId) : null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!img) return;
    try {
      const c = cut ? cutoutBoard(img, tol) : drawScaled(img, img.naturalWidth, img.naturalHeight, 1400);
      setCanvas(c);
      setPreview(c.toDataURL('image/png'));
      setMsg(cut ? 'Fundo recortado. Se cortou demais ou de menos, ajuste a sensibilidade.' : 'Foto sem recorte.');
    } catch (e) {
      setMsg(errorMessage(e));
      setCanvas(null);
    }
  }, [img, tol, cut]);
  const save = async () => {
    setBusy(true);
    try {
      let imageId = b.imageId;
      if (canvas) {
        const up = await uploadCanvas(canvas, cut);
        imageId = up.id;
        toast(`Foto otimizada: ${kb(up.bytes)}.`);
      }
      const body = { ...b, imageId };
      delete (body as { id?: string }).id;
      if (b.id) await api(`/api/admin/boards/${b.id}`, { method: 'PUT', body });
      else await api('/api/admin/boards', { body });
      onDone();
    } catch (e) {
      setMsg(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={b.id ? 'Editar prancha' : 'Nova prancha'} onClose={onClose} className="wide">
      <div className="cutout">
        <div className="board-stage big">{preview ? <img className="board-img" src={preview} alt="Prévia da prancha" /> : <div className="board-empty"><Icon name="camera" /></div>}</div>
        <div className="row wrap spacer-sm">
          <label className="btn secondary file-btn"><Icon name="camera" />Tirar ou escolher foto<input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setMsg('Abrindo a foto…'); setImg(await loadImage(f)); } }} /></label>
          {img && <label className="check"><input type="checkbox" checked={cut} onChange={(e) => setCut(e.target.checked)} />Recortar o fundo</label>}
        </div>
        {img && cut && <div className="field"><label htmlFor="tol">Sensibilidade do recorte</label><input id="tol" type="range" min={8} max={70} value={tol} onChange={(e) => setTol(Number(e.target.value))} /></div>}
        {msg && <p className="legal-note">{msg}</p>}
      </div>
      <div className="form-grid">
        <div className="field"><label htmlFor="b-name">Nome</label><input id="b-name" maxLength={60} value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} placeholder="Ex.: Longboard Azul" /></div>
        <div className="field"><label htmlFor="b-type">Tipo</label><select id="b-type" value={b.type} onChange={(e) => setB({ ...b, type: e.target.value })}>{BOARD_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div className="field"><label htmlFor="b-size">Tamanho</label><input id="b-size" maxLength={20} value={b.size} onChange={(e) => setB({ ...b, size: e.target.value })} placeholder="9'2”" /></div>
        <div className="field"><label htmlFor="b-vol">Volume</label><input id="b-vol" maxLength={20} value={b.volume} onChange={(e) => setB({ ...b, volume: e.target.value })} placeholder="78 L" /></div>
        <div className="field"><label htmlFor="b-level">Nível</label><select id="b-level" value={b.level} onChange={(e) => setB({ ...b, level: e.target.value })}>{LEVELS.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div className="field"><label htmlFor="b-cond">Estado</label><select id="b-cond" value={b.condition} onChange={(e) => setB({ ...b, condition: e.target.value as 'ok' })}><option value="ok">Em uso</option><option value="reparo">Em reparo</option></select></div>
        <div className="field full"><label htmlFor="b-desc">Descrição</label><textarea id="b-desc" maxLength={400} value={b.description} onChange={(e) => setB({ ...b, description: e.target.value })} /></div>
      </div>
      <label className="check"><input type="checkbox" checked={b.available && b.condition === 'ok'} disabled={b.condition !== 'ok'} onChange={(e) => setB({ ...b, available: e.target.checked })} />Mostrar para os alunos</label>
      <div className="modal-actions wrap">
        {b.id && <Btn variant="danger" icon="trash" onClick={async () => { if (confirm('Remover esta prancha do quiver?')) { await api(`/api/admin/boards/${b.id}`, { method: 'DELETE' }); onDone(); } }}>Remover</Btn>}
        <Btn icon="check" busy={busy} disabled={b.name.trim().length < 2} onClick={save}>Salvar</Btn>
      </div>
    </Modal>
  );
}

export function QuiverPage() {
  useTitle('Quiver');
  const toast = useToast();
  const { data, reload } = useApi<{ boards: Board[] }>('/api/admin/boards');
  const { data: st, reload: reloadSt } = useApi<{ settings: Record<string, unknown> & { quiverEnabled: boolean; whatsapp: string } }>('/api/admin/settings');
  const [edit, setEdit] = useState<Draft | null>(null);
  if (!data || !st) return <Spinner />;
  const on = st.settings.quiverEnabled;
  const toggle = async () => {
    try {
      await api('/api/admin/settings', { method: 'PUT', body: { ...st.settings, quiverEnabled: !on } });
      toast(!on ? 'Quiver ativado: os alunos já veem as pranchas.' : 'Quiver desligado: some do app dos alunos.');
      reloadSt();
    } catch (e) {
      toast(errorMessage(e));
    }
  };
  return (
    <div className="page-content">
      <PageTitle title="Quiver." sub="Pranchas da escola com foto recortada automaticamente." action={<Btn icon="plus" onClick={() => setEdit({ ...EMPTY })}>Nova prancha</Btn>} />
      <section className="card">
        <div className="toggle-row">
          <div><strong>Mostrar o quiver no app do aluno</strong><small>{on ? 'Ativo: aparece a aba Pranchas e a prancha de cada aula.' : 'Desligado: o aluno não vê nada sobre pranchas. Você pode cadastrar com calma e ligar quando quiser.'}</small></div>
          <label className="switch"><input type="checkbox" checked={on} onChange={toggle} /><span /></label>
        </div>
      </section>
      <div className="board-gallery spacer">
        {data.boards.length ? data.boards.map((b) => (
          <section key={b.id} className={`card board-card ${b.available ? '' : 'unavailable'}`}>
            <div className="row between"><div className="eyebrow">{b.type.toUpperCase()}</div><span className={`badge ${b.available && b.condition === 'ok' ? '' : 'gray'}`}>{b.condition === 'reparo' ? 'EM REPARO' : b.available ? 'DISPONÍVEL' : 'SÓ DO INSTRUTOR'}</span></div>
            <div className="board-title"><h3>{b.name}</h3></div>
            <div className="board-stage">{b.imageId ? <img className="board-img" src={imageUrl(b.imageId)!} alt={b.name} loading="lazy" /> : <div className="board-empty"><Icon name="board" /></div>}</div>
            <div className="board-measures"><div><small>TAMANHO</small><strong>{b.size || '—'}</strong></div><div><small>VOLUME</small><strong>{b.volume || '—'}</strong></div><div><small>NÍVEL</small><strong style={{ fontSize: 11 }}>{b.level}</strong></div></div>
            <button type="button" className="text-btn" onClick={() => setEdit({ ...b })}>Editar <Icon name="edit" /></button>
          </section>
        )) : <Empty icon="board" title="Nenhuma prancha ainda." text="Fotografe a prancha num fundo liso: o app recorta o fundo sozinho." action={<Btn icon="camera" onClick={() => setEdit({ ...EMPTY })}>Cadastrar a primeira</Btn>} />}
      </div>
      {edit && <BoardEditor initial={edit} onClose={() => setEdit(null)} onDone={() => (setEdit(null), reload(), toast('Quiver atualizado.'))} />}
    </div>
  );
}
