import type { Context } from 'hono';
import type { Sql } from 'postgres';

import type { Env } from './env';
import type { SettingsRow } from './services/settings';

export interface AdminContext {
  id: string;
  email: string;
  name: string;
  sessionId: string;
  totpEnabled: boolean;
}

export interface Vars {
  db: () => Sql;
  settings: () => Promise<SettingsRow>;
  admin: AdminContext;
  studentId: string;
  ipKey: string;
}

export type AppEnv = { Bindings: Env; Variables: Vars };
export type Ctx = Context<AppEnv>;
