import type { Sql } from 'postgres';

export interface Env {
  /** Arquivos estáticos (SPA) — presente no Cloudflare. */
  ASSETS?: { fetch: (req: Request) => Promise<Response> };
  /** Hyperdrive (recomendado com o Supabase): pooling de conexões na borda. */
  HYPERDRIVE?: { connectionString: string };
  /** Alternativa ao Hyperdrive: URL do pooler do Supabase (modo transação, porta 6543). */
  DATABASE_URL?: string;
  ENVIRONMENT?: 'production' | 'preview' | 'development' | 'test';
  APP_ORIGIN?: string;
  /** 32 bytes em base64url — criptografa o segredo do 2FA em repouso. */
  DATA_ENCRYPTION_KEY?: string;
  /** Segredo para pseudonimizar IPs nos limites de tentativas. */
  RATE_LIMIT_SALT?: string;
  REQUIRE_MFA?: string;
  // Notificações push: JWK EC P-256 privado (`npm run push:keys`) e contato do remetente.
  VAPID_PRIVATE_JWK?: string;
  VAPID_SUBJECT?: string;
  /** Somente testes em Node: cliente SQL compartilhado. */
  TEST_SQL?: Sql;
  /** Somente testes: substitui o fetch da previsão. */
  TEST_FETCH?: typeof fetch;
}

export const isProduction = (env: Env) => env.ENVIRONMENT === 'production';
