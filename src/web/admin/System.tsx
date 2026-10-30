import { Icon } from '../components/icons';
import { Btn, Detail, PageTitle, Spinner, useToast } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { useApi } from '../lib/hooks';
import { ago } from '../lib/format';
import { useTitle } from '../lib/router';

interface StatusRow {
  ok: boolean | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  detail: string | null;
}
interface Sys {
  environment: string;
  database: { ok: boolean; latencyMs: number | null; sizeBytes: number | null; freeTierLimitBytes: number; tables: { table: string; rows: number }[] };
  cron: StatusRow | null;
  backup: StatusRow | null;
  forecast: StatusRow | null;
  integrations: { push: boolean; hyperdrive: boolean };
  alerts: string[];
}

const when = (r: StatusRow | null) => (r?.last_success_at ? `OK ${ago(r.last_success_at)}` : 'Ainda não rodou');

export function SystemPage() {
  useTitle('Sistema');
  const toast = useToast();
  const { data, reload } = useApi<Sys>('/api/admin/system');
  if (!data) return <Spinner />;
  const mb = (b: number | null) => (b == null ? '—' : `${(b / 1024 / 1024).toFixed(1)} MB`);
  return (
    <div className="page-content">
      <PageTitle title="Sistema." sub="Saúde do app, do banco e das tarefas automáticas." action={<Btn variant="secondary" icon="refresh" onClick={reload}>Atualizar</Btn>} />
      {data.alerts.map((a) => <div key={a} className="notice warn"><Icon name="info" /><p>{a}</p></div>)}
      <div className="stats four">
        <div className="card stat"><small>BANCO</small><strong>{data.database.ok ? 'OK' : 'Fora'}</strong><span>{data.database.latencyMs ?? '—'} ms</span></div>
        <div className="card stat"><small>ESPAÇO USADO</small><strong>{mb(data.database.sizeBytes)}</strong><span>de {mb(data.database.freeTierLimitBytes)} grátis</span></div>
        <div className="card stat"><small>VERIFICAÇÃO (15 MIN)</small><strong>{data.cron?.ok === false ? 'Falhou' : 'OK'}</strong><span>{when(data.cron)}</span></div>
        <div className="card stat"><small>PREVISÃO DO MAR</small><strong>{data.forecast?.ok === false ? 'Falhou' : 'OK'}</strong><span>{when(data.forecast)}</span></div>
      </div>
      <section className="card spacer">
        <h3>Detalhes</h3>
        <Detail label="Ambiente">{data.environment}</Detail>
        <Detail label="Notificações push">{data.integrations.push ? 'Configuradas' : 'Faltam as chaves VAPID'}</Detail>
        <Detail label="Conexão Hyperdrive">{data.integrations.hyperdrive ? 'Ativa' : 'Não configurada'}</Detail>
        <Detail label="Último backup">{when(data.backup)}</Detail>
        {data.database.tables.map((t) => <Detail key={t.table} label={`Registros · ${t.table}`}>{t.rows}</Detail>)}
        <div className="modal-actions">
          <Btn variant="secondary" icon="tide" onClick={async () => { try { const r = await api<{ ok: string[]; failed: string[] }>('/api/admin/forecast/refresh', { body: {} }); toast(r.failed.length ? `Falhou: ${r.failed.join(', ')}` : 'Previsão atualizada.'); reload(); } catch (e) { toast(errorMessage(e)); } }}>Atualizar previsão agora</Btn>
        </div>
      </section>
    </div>
  );
}
