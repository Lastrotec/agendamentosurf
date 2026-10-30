import { Buffer } from 'node:buffer';
import { EventEmitter } from 'node:events';

import postgres, { type Sql } from 'postgres';

import type { Env } from '../env';

const MAX_CONNECT_ATTEMPTS = 3;

/** Resume as primeiras mensagens do servidor (tipo + texto de erro) para diagnóstico no log. */
function describe(buf: Uint8Array): string {
  const out: string[] = [];
  let i = 0;
  while (i + 5 <= buf.length && out.length < 6) {
    const type = String.fromCharCode(buf[i]);
    const len = (buf[i + 1] << 24) | (buf[i + 2] << 16) | (buf[i + 3] << 8) | buf[i + 4];
    if (type === 'E') {
      const fields = new TextDecoder().decode(buf.subarray(i + 5, i + 1 + len)).split('\0');
      const pick = (c: string) => fields.find((f) => f.startsWith(c))?.slice(1) ?? '';
      out.push(`E(${pick('C')}: ${pick('M')})`);
    } else out.push(type);
    i += 1 + len;
  }
  return out.join(',');
}

/**
 * Socket TCP+TLS próprio sobre cloudflare:sockets.
 * Faz o SSLRequest do Postgres e o startTls antes de entregar o socket ao postgres.js
 * (que então fala o protocolo como se fosse texto puro, dentro do túnel TLS).
 * Motivo: o polyfill do postgres.js reconecta sem limite quando o upgrade TLS falha,
 * estourando o limite de subrequests do Worker e escondendo o erro real.
 */
function tlsSocketFactory(host: string, port: number) {
  let attempts = 0;
  return async () => {
    attempts += 1;
    if (attempts > MAX_CONNECT_ATTEMPTS) throw new Error(`Banco indisponível após ${MAX_CONNECT_ATTEMPTS} tentativas de conexão.`);
    const { connect } = await import('cloudflare:sockets');
    const ev = new EventEmitter();
    let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
    let closed = false;
    let bytesIn = 0;
    let first: Uint8Array | null = null;
    const state = { readyState: 'open' as 'open' | 'closed' };

    const close = () => {
      if (closed) return;
      closed = true;
      state.readyState = 'closed';
      if (bytesIn === 0 || (first && first[0] === 0x45)) {
        console.error(`[db] conexão encerrada (tentativa ${attempts}, ${bytesIn} bytes recebidos${first ? `: ${describe(first)}` : ''})`);
      }
      ev.emit('close');
    };
    const fail = (err: unknown) => {
      if (closed) return;
      console.error(`[db] socket (tentativa ${attempts}):`, err instanceof Error ? err.message : String(err));
      ev.emit('error', err instanceof Error ? err : new Error(String(err)));
      close();
    };

    const ready = (async () => {
      const plain = connect({ hostname: host, port }, { secureTransport: 'starttls', allowHalfOpen: false });
      const w = plain.writable.getWriter();
      const r = plain.readable.getReader();
      // SSLRequest: length 8 + código 80877103
      await w.write(new Uint8Array([0, 0, 0, 8, 4, 210, 22, 47]));
      const { value } = await r.read();
      if (!value || value[0] !== 0x53) throw new Error('Servidor não aceitou TLS (SSLRequest recusado).');
      w.releaseLock();
      r.releaseLock();
      const secure = plain.startTls();
      writer = secure.writable.getWriter();
      const reader = secure.readable.getReader();
      secure.closed.then(close, fail);
      void (async () => {
        try {
          for (;;) {
            const { done, value: chunk } = await reader.read();
            if (done) break;
            bytesIn += chunk.length;
            first ??= chunk;
            ev.emit('data', Buffer.from(chunk));
          }
          close();
        } catch (e) {
          fail(e);
        }
      })();
    })();
    ready.catch(fail);

    // defineProperty: Object.assign copiaria o valor do getter, não o getter
    Object.defineProperty(ev, 'readyState', { get: () => state.readyState });
    return Object.assign(ev, {
      write(data: Uint8Array, cb?: () => void) {
        ready.then(() => writer!.write(data)).then(() => cb?.(), fail);
        return true;
      },
      end(data?: Uint8Array) {
        const finish = () => writer?.close().catch(() => {});
        if (data) ready.then(() => writer!.write(data)).then(finish, () => {});
        else ready.then(finish, () => {});
        return ev;
      },
      destroy() {
        ready.then(() => writer?.abort().catch(() => {}), () => {});
        close();
        return ev;
      },
      setKeepAlive() {},
    });
  };
}

/**
 * Cria um cliente SQL por requisição (Workers não reaproveitam sockets entre requisições).
 * Com Hyperdrive, o pooling acontece na borda; sem ele, use o pooler do Supabase em modo transação.
 * Todas as consultas usam template tags → parâmetros sempre enviados separados do SQL.
 */
export function createSql(env: Env): { sql: Sql; close: () => Promise<void> } {
  if (env.TEST_SQL) return { sql: env.TEST_SQL, close: async () => {} };
  const hyperdrive = env.HYPERDRIVE?.connectionString;
  const url = hyperdrive ?? env.DATABASE_URL;
  if (!url) throw new Error('Banco de dados não configurado (HYPERDRIVE ou DATABASE_URL).');
  const base = {
    max: 1,
    prepare: false, // obrigatório no pooler do Supabase em modo transação
    fetch_types: false,
    idle_timeout: 5,
    connect_timeout: 8,
  } as const;
  let sql: Sql;
  if (hyperdrive) {
    sql = postgres(url, base);
  } else {
    const u = new URL(url);
    // Como no postgres.js: TLS só quando a URL pede (sslmode=require/prefer/verify-*).
    const wantsTls = ['require', 'prefer', 'verify-ca', 'verify-full'].includes(u.searchParams.get('sslmode') ?? '');
    u.searchParams.delete('sslmode');
    sql = postgres(u.toString(), {
      ...base,
      ssl: false, // o TLS é feito pelo socket próprio abaixo
      ...(wantsTls ? { socket: tlsSocketFactory(u.hostname, Number(u.port || 5432)) } : {}),
    });
  }
  return { sql, close: () => sql.end({ timeout: 2 }) };
}
