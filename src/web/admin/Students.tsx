// Alunos: busca, ficha (contato, nível, prancha, anotações privadas, dicas), código de nova senha e exclusão (LGPD).
import { useState } from 'react';

import { LEVELS } from '../../shared/domain';
import { formatPhoneBR, maskPhoneInput } from '../../shared/phone';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/icons';
import { Btn, Detail, Empty, Modal, PageTitle, Spinner, useToast } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { useApi } from '../lib/hooks';
import { fmt, money, whatsappLink } from '../lib/format';
import { navigate, useSearch, useTitle } from '../lib/router';
import type { BookingView, OrderView } from '../lib/types';
import { statusLabel } from './Bookings';

interface Row {
  id: string;
  name: string;
  phone: string | null;
  level: string;
  avatar: string;
  lessons: number;
  hasPassword: boolean;
  next: string | null;
  since: string;
}
interface Profile {
  student: { id: string; name: string; phone: string | null; level: string; avatar: string; boardId: string | null; adminNotes: string; hasPassword: boolean; since: string };
  bookings: BookingView[];
  orders: OrderView[];
  tips: { id: string; text: string; at: string }[];
}

function StudentModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const { data, reload } = useApi<Profile>(`/api/admin/students/${id}`);
  const { data: boards } = useApi<{ boards: { id: string; name: string; size: string }[] }>('/api/admin/boards');
  const [edit, setEdit] = useState<Profile['student'] | null>(null);
  const [tip, setTip] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!data) return <Modal title="Aluno" onClose={onClose}><Spinner /></Modal>;
  const s = data.student;
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setError(null);
    try {
      await fn();
      toast(ok);
      reload();
      onChanged();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    }
  };
  return (
    <Modal title="Ficha do aluno" onClose={onClose} className="wide">
      <div className="profile-head">
        <Avatar id={s.avatar} size={68} className="big" />
        <div>
          <h2>{s.name}</h2>
          <p>{s.phone ? <a className="link" href={whatsappLink(s.phone)} target="_blank" rel="noopener noreferrer">{formatPhoneBR(s.phone)} · WhatsApp</a> : 'Sem celular'}</p>
          <span className="badge orange">{s.level}</span>{' '}
          {!s.hasPassword && <span className="badge gray">SEM ACESSO AO APP</span>}
        </div>
      </div>
      {error && <div className="notice warn spacer"><Icon name="info" /><p>{error}</p></div>}
      {edit ? (
        <div className="card spacer confirm-box">
          <div className="form-grid">
            <div className="field"><label htmlFor="se-name">Nome</label><input id="se-name" maxLength={60} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div className="field"><label htmlFor="se-phone">Celular</label><input id="se-phone" type="tel" value={edit.phone ? maskPhoneInput(edit.phone.replace(/^55/, '')) : ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></div>
            <div className="field"><label htmlFor="se-level">Nível</label><select id="se-level" value={edit.level} onChange={(e) => setEdit({ ...edit, level: e.target.value })}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select></div>
            <div className="field"><label htmlFor="se-board">Prancha habitual</label><select id="se-board" value={edit.boardId ?? ''} onChange={(e) => setEdit({ ...edit, boardId: e.target.value || null })}><option value="">A definir</option>{boards?.boards.map((b) => <option key={b.id} value={b.id}>{b.name} {b.size}</option>)}</select></div>
            <div className="field full"><label htmlFor="se-notes">Anotações privadas (só você vê)</label><textarea id="se-notes" maxLength={2000} value={edit.adminNotes} onChange={(e) => setEdit({ ...edit, adminNotes: e.target.value })} /></div>
          </div>
          <div className="modal-actions">
            <Btn variant="secondary" onClick={() => setEdit(null)}>Voltar</Btn>
            <Btn icon="check" onClick={async () => (await run(() => api(`/api/admin/students/${s.id}`, { method: 'PUT', body: { name: edit.name, phone: edit.phone || null, level: edit.level, boardId: edit.boardId, adminNotes: edit.adminNotes } }), 'Dados salvos.')) && setEdit(null)}>Salvar</Btn>
          </div>
        </div>
      ) : (
        <div className="req-actions">
          <Btn variant="secondary" icon="edit" onClick={() => setEdit({ ...s })}>Editar</Btn>
          <Btn variant="secondary" icon="calendar" onClick={() => (onClose(), navigate('/painel/agenda?novo=1'))}>Agendar aula</Btn>
          {s.phone && <Btn variant="secondary" icon="lock" onClick={() => run(async () => setCode((await api<{ code: string }>(`/api/admin/students/${s.id}/reset-code`, { body: {} })).code), 'Código gerado.')}>Código de nova senha</Btn>}
          <Btn variant="danger" icon="trash" onClick={() => setConfirmDel(true)}>Apagar dados</Btn>
        </div>
      )}
      {code && s.phone && (
        <div className="notice ok spacer">
          <Icon name="lock" />
          <div>
            <p>Código <strong style={{ fontSize: 18, letterSpacing: 3 }}>{code}</strong> (vale 24 h). O aluno entra em “Esqueci a senha” e cria uma nova.</p>
            <a className="btn small spacer-sm" href={whatsappLink(s.phone, `Oi ${s.name.split(' ')[0]}! Seu código para criar uma nova senha no app da Outside é ${code} (vale 24 h). No app, toque em Entrar → Esqueci a senha.`)} target="_blank" rel="noopener noreferrer">Enviar pelo WhatsApp <Icon name="send" /></a>
          </div>
        </div>
      )}
      {confirmDel && (
        <div className="card spacer confirm-box">
          <h3>Apagar os dados de {s.name}?</h3>
          <p className="muted">Nome, celular e acesso são apagados. O histórico financeiro fica sem identificação. Não dá para desfazer.</p>
          <div className="modal-actions">
            <Btn variant="secondary" onClick={() => setConfirmDel(false)}>Voltar</Btn>
            <Btn variant="danger" onClick={async () => (await run(() => api(`/api/admin/students/${s.id}`, { method: 'DELETE' }), 'Dados apagados.')) && onClose()}>Apagar</Btn>
          </div>
        </div>
      )}
      {s.adminNotes && !edit && <div className="hint"><strong>Anotações:</strong> {s.adminNotes}</div>}
      <div className="sheet-section">
        <h4>Dica para o aluno (aparece no app dele)</h4>
        <div className="copy-row">
          <input aria-label="Nova dica" maxLength={600} value={tip} onChange={(e) => setTip(e.target.value)} placeholder="Ex.: na próxima aula vamos treinar a remada." />
          <Btn icon="send" disabled={!tip.trim()} onClick={async () => (await run(() => api(`/api/admin/students/${s.id}/tips`, { body: { text: tip } }), 'Dica enviada ao aluno.')) && setTip('')}>Enviar</Btn>
        </div>
        {data.tips.map((t) => <div key={t.id} className="note"><small>{fmt(t.at.slice(0, 10))}</small><p>{t.text}</p></div>)}
      </div>
      <div className="sheet-section">
        <h4>Pacotes e pedidos</h4>
        {data.orders.length ? data.orders.map((o) => <Detail key={o.id} label={`${o.planLabel} · ${o.code}`}>{money(o.paidCents)} de {money(o.totalCents)}{o.plan !== 'single' ? ` · ${o.used}/${o.lessons}` : ''}{o.refundDueCents ? ` · devolver ${money(o.refundDueCents)}` : ''}</Detail>) : <p className="muted">Nenhum pedido.</p>}
      </div>
      <div className="sheet-section">
        <h4>Aulas</h4>
        {data.bookings.length ? data.bookings.map((b) => (
          <button key={b.id} type="button" className="detail-row as-btn" onClick={() => (onClose(), navigate(`/painel/aula/${b.id}`))}><span>{fmt(b.date, { day: '2-digit', month: '2-digit', year: '2-digit' })} · {b.time} · {b.place}</span><strong>{statusLabel(b)[0]}</strong></button>
        )) : <p className="muted">Nenhuma aula.</p>}
      </div>
    </Modal>
  );
}

export function StudentsPage() {
  useTitle('Alunos');
  const q = useSearch();
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState<string | null>(q.get('id'));
  const [add, setAdd] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { data, reload } = useApi<{ students: Row[] }>(`/api/admin/students${term.trim().length >= 2 ? `?q=${encodeURIComponent(term.trim())}` : ''}`);
  return (
    <div className="page-content">
      <PageTitle title="Alunos." sub={`${data?.students.length ?? '…'} cadastrados. Toque para abrir a ficha.`} action={<Btn icon="plus" onClick={() => setAdd(true)}>Novo aluno</Btn>} />
      <div className="field"><input aria-label="Buscar aluno" placeholder="Buscar por nome ou celular" value={term} onChange={(e) => setTerm(e.target.value)} /></div>
      {!data ? <Spinner /> : data.students.length ? (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Aluno</th><th>Celular</th><th>Nível</th><th>Aulas</th><th>Próxima</th></tr></thead>
            <tbody>
              {data.students.map((s) => (
                <tr key={s.id} onClick={() => setOpen(s.id)} style={{ cursor: 'pointer' }}>
                  <td><span className="row"><Avatar id={s.avatar} size={30} /><span><strong>{s.name}</strong>{!s.hasPassword && <small className="muted"> · sem acesso</small>}</span></span></td>
                  <td>{formatPhoneBR(s.phone)}</td>
                  <td>{s.level}</td>
                  <td>{s.lessons}</td>
                  <td>{s.next ? fmt(s.next.slice(0, 10), { day: '2-digit', month: '2-digit' }) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty icon="users" title="Nenhum aluno encontrado." text="Os alunos aparecem aqui quando se cadastram no app." />}
      {open && <StudentModal id={open} onClose={() => setOpen(null)} onChanged={reload} />}
      {add && (
        <Modal title="Novo aluno" onClose={() => setAdd(false)}>
          <p className="muted">O aluno pode depois criar a senha no app com o mesmo celular e o mesmo primeiro nome.</p>
          <div className="field"><label htmlFor="na-name">Nome</label><input id="na-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field"><label htmlFor="na-phone">Celular</label><input id="na-phone" type="tel" value={phone} onChange={(e) => setPhone(maskPhoneInput(e.target.value))} /></div>
          {error && <p className="error-text">{error}</p>}
          <div className="modal-actions">
            <Btn icon="check" onClick={async () => {
              try {
                const r = await api<{ id: string }>('/api/admin/students', { body: { name, phone } });
                setAdd(false);
                reload();
                setOpen(r.id);
              } catch (e) {
                setError(errorMessage(e));
              }
            }}>Cadastrar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
