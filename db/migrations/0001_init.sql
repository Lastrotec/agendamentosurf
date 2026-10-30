-- Outside Surf School — esquema inicial (PostgreSQL 15+ / Supabase).
-- Uma escola só. Horários em timestamptz (UTC); datas e horas de aula em America/Bahia.
-- Dados mínimos dos alunos: nome, celular e hash da senha (nada de e-mail, CPF ou endereço).

-- ---------------------------------------------------------------------------
-- Configurações (linha única) — tudo que o Romário ajusta pelo painel
-- ---------------------------------------------------------------------------
create table settings (
  id                    smallint primary key default 1 check (id = 1),
  school                text not null default 'Outside Surf School' check (length(school) between 2 and 60),
  instructor            text not null default 'Romário de Jesus' check (length(instructor) between 2 and 60),
  whatsapp              text not null default '5571992208398' check (whatsapp ~ '^55[1-9][0-9]{9,10}$'),
  pix_key               text not null default '+5571992208398' check (length(pix_key) between 5 and 77),
  pix_name              text not null default 'Romario de Jesus Gomes' check (length(pix_name) between 2 and 25),
  pix_city              text not null default 'Salvador' check (length(pix_city) between 2 and 15),
  deposit_pct           int  not null default 50 check (deposit_pct between 10 and 100),
  hold_minutes          int  not null default 30 check (hold_minutes between 5 and 240),
  auto_confirm          boolean not null default false,
  -- Cancelamento pelo aluno: até X horas antes. O valor pago fica "a devolver" e o Romário devolve manualmente.
  cancel_limit_hours    int  not null default 24 check (cancel_limit_hours between 0 and 720),
  reschedule_limit      int  not null default 1 check (reschedule_limit between 0 and 5),
  reschedule_limit_hours int not null default 12 check (reschedule_limit_hours between 0 and 720),
  min_notice_hours      int  not null default 2 check (min_notice_hours between 0 and 72),
  horizon_days          int  not null default 60 check (horizon_days between 7 and 180),
  pack5_days            int  not null default 60 check (pack5_days between 7 and 365),
  pack10_days           int  not null default 90 check (pack10_days between 7 and 365),
  -- Lembretes: lista de horas antes da aula (ex.: [24, 3]) + aviso na manhã do dia (hora local).
  remind_student_hours  int[] not null default '{24,3}',
  remind_admin_hours    int[] not null default '{24,3}',
  remind_morning_at     time default '06:30',                    -- aviso "hoje tem aula" (null = desligado)
  quiver_enabled        boolean not null default false,          -- desligado: aluno nem vê que existe
  texts                 jsonb not null default '{}'::jsonb,      -- textos editáveis do site
  images                jsonb not null default '{}'::jsonb,      -- slot -> id da imagem
  privacy_policy        text not null default '',
  terms                 text not null default '',
  updated_at            timestamptz not null default now()
);

create table places (
  id           text primary key check (id ~ '^[a-z0-9-]{2,30}$'),
  name         text not null check (length(name) between 2 and 60),
  short        text not null check (length(short) between 2 and 30),
  address      text not null default '' check (length(address) <= 160),
  meeting      text not null default '' check (length(meeting) <= 400),
  description  text not null default '' check (length(description) <= 600),
  modality     text not null default 'Individual' check (length(modality) <= 40),
  capacity     int  not null default 1 check (capacity between 1 and 10),
  weekdays     int[] not null default '{0,1,3,4,5,6}',
  hours        text[] not null default '{}',                    -- horários fixos (HH:MM)
  schedule     text not null default 'fixed' check (schedule in ('fixed','tide')),
  price_single int  not null check (price_single between 100 and 10000000),   -- centavos
  price_pack5  int  not null check (price_pack5 between 100 and 10000000),
  price_pack10 int  not null check (price_pack10 between 100 and 10000000),
  image_id     text,
  lat          double precision not null,
  lon          double precision not null,
  facing       int  not null default 135 check (facing between 0 and 359),     -- para onde a praia "olha"
  -- Calibração do motor de ondas: quanto do mar aberto chega ao pico (0,1–1,5) e a direção de exposição.
  wave_factor  numeric(3,2) not null default 1.00 check (wave_factor between 0.10 and 1.50),
  exposure_from int not null default 45 check (exposure_from between 0 and 359),
  exposure_to   int not null default 225 check (exposure_to between 0 and 359),
  active       boolean not null default true,
  sort         int not null default 0
);

create table boards (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(name) between 2 and 60),
  size        text not null default '' check (length(size) <= 20),
  volume      text not null default '' check (length(volume) <= 20),
  type        text not null default 'Longboard' check (length(type) <= 30),
  level       text not null default 'Iniciante' check (length(level) <= 30),
  description text not null default '' check (length(description) <= 400),
  image_id    text,
  available   boolean not null default true,
  condition   text not null default 'ok' check (condition in ('ok','reparo')),
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);

-- Imagens já comprimidas no aparelho (WebP/JPEG). Endereçadas pelo hash: cache eterno na borda.
create table images (
  id         text primary key check (id ~ '^[a-f0-9]{24}$'),
  mime       text not null check (mime in ('image/webp','image/jpeg','image/png')),
  bytes      bytea not null check (octet_length(bytes) <= 900000),
  width      int not null check (width between 1 and 4000),
  height     int not null check (height between 1 and 4000),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Alunos (dados mínimos)
-- ---------------------------------------------------------------------------
create table students (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (length(name) between 2 and 60),
  phone            text unique check (phone is null or phone ~ '^55[1-9][0-9]{10}$'),
  password_hash    text,
  level            text not null default 'Primeiro contato' check (length(level) <= 30),
  board_id         uuid references boards(id) on delete set null,
  admin_notes      text not null default '' check (length(admin_notes) <= 2000),
  consent_at       timestamptz,
  reset_code_hash  text,                     -- código temporário gerado pelo Romário ("esqueci a senha")
  reset_expires_at timestamptz,
  failed_attempts  int not null default 0,
  locked_until     timestamptz,
  last_seen_at     timestamptz,
  anonymized_at    timestamptz,
  created_at       timestamptz not null default now()
);
create index students_name_idx on students (lower(name));

create table student_sessions (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students(id) on delete cascade,
  token_hash   text not null unique,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index student_sessions_student_idx on student_sessions (student_id);

-- Orientações do instrutor que o aluno vê ("dica do instrutor").
create table tips (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  text       text not null check (length(text) between 1 and 600),
  created_at timestamptz not null default now()
);
create index tips_student_idx on tips (student_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Pedidos (aula avulsa ou pacote) e aulas
-- ---------------------------------------------------------------------------
create table orders (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique check (code ~ '^OS[A-Z0-9]{5,8}$'),
  student_id     uuid not null references students(id),
  place_id       text not null references places(id),
  plan           text not null check (plan in ('single','pack5','pack10')),
  lessons        int  not null check (lessons between 1 and 10),
  people         int  not null default 1 check (people between 1 and 10),
  companion      text check (companion is null or length(companion) <= 60),
  total_cents    int  not null check (total_cents >= 0),
  deposit_cents  int  not null check (deposit_cents >= 0),
  paid_cents     int  not null default 0 check (paid_cents >= 0),
  refunded_cents int  not null default 0 check (refunded_cents >= 0),
  refund_due_cents int not null default 0 check (refund_due_cents >= 0),  -- a devolver pelo Romário
  expires_on     date,
  status         text not null default 'pending' check (status in ('pending','active','paid','cancelled','expired')),
  source         text not null default 'student' check (source in ('student','admin')),
  idempotency_key text unique check (idempotency_key is null or length(idempotency_key) between 16 and 80),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index orders_student_idx on orders (student_id, created_at desc);

create table bookings (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique check (code ~ '^OS[A-Z0-9]{5,8}$'),
  order_id       uuid not null references orders(id),
  student_id     uuid not null references students(id),
  place_id       text not null references places(id),
  date           date not null,
  time           text not null check (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  starts_at      timestamptz not null,
  people         int  not null default 1 check (people between 1 and 10),
  status         text not null check (status in ('pending_payment','awaiting','confirmed','done','no_show','cancelled','declined','expired')),
  hold_until     timestamptz,
  pix_claimed_at timestamptz,                 -- aluno avisou "já fiz o Pix"
  board_id       uuid references boards(id) on delete set null,
  rescheduled    int  not null default 0,
  cancelled_by   text check (cancelled_by in ('student','admin','system')),
  reason         text check (reason is null or length(reason) <= 400),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index bookings_slot_idx on bookings (place_id, date, time) where status in ('pending_payment','awaiting','confirmed');
create index bookings_student_idx on bookings (student_id, starts_at desc);
create index bookings_starts_idx on bookings (starts_at);

create table booking_events (
  id         bigserial primary key,
  booking_id uuid not null references bookings(id) on delete cascade,
  text       text not null check (length(text) <= 300),
  created_at timestamptz not null default now()
);
create index booking_events_idx on booking_events (booking_id, created_at);

create table payments (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id),
  amount_cents  int  not null check (amount_cents <> 0),     -- negativo = devolução
  method        text not null check (method in ('pix','card','cash','other')),
  kind          text not null check (kind in ('deposit','full','remaining','refund')),
  provider      text not null default 'manual',
  provider_ref  text check (provider_ref is null or length(provider_ref) <= 120),
  note          text check (note is null or length(note) <= 200),
  created_at    timestamptz not null default now(),
  unique (provider, provider_ref)
);
create index payments_order_idx on payments (order_id);
create index payments_created_idx on payments (created_at desc);

-- Agenda: bloqueios de dia/horário e horários do Farol definidos pela maré
create table slot_blocks (
  id         uuid primary key default gen_random_uuid(),
  place_id   text not null references places(id) on delete cascade,
  date       date not null,
  time       text check (time is null or time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  reason     text not null default '' check (length(reason) <= 120),
  created_at timestamptz not null default now()
);
create index slot_blocks_idx on slot_blocks (place_id, date);

create table day_hours (
  place_id text not null references places(id) on delete cascade,
  date     date not null,
  hours    text[] not null,
  primary key (place_id, date)
);

-- Avisos dentro do app (sino)
create table inbox (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,   -- null = para o instrutor
  title      text not null check (length(title) <= 120),
  body       text not null check (length(body) <= 400),
  booking_id uuid references bookings(id) on delete set null,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index inbox_student_idx on inbox (student_id, created_at desc);

-- Previsão do mar coletada pelo servidor (um registro por pico)
create table forecasts (
  place_id   text primary key references places(id) on delete cascade,
  data       jsonb not null,
  fetched_at timestamptz not null default now(),
  ok         boolean not null default true,
  error      text
);

-- ---------------------------------------------------------------------------
-- Administração, push e segurança
-- ---------------------------------------------------------------------------
create table admins (
  id               uuid primary key default gen_random_uuid(),
  email            text not null unique check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  name             text not null,
  password_hash    text not null,
  totp_secret_enc  text,
  totp_enabled     boolean not null default false,
  totp_last_step   bigint,
  failed_attempts  int not null default 0,
  locked_until     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table admin_sessions (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid not null references admins(id) on delete cascade,
  token_hash   text not null unique,
  mfa_passed   boolean not null default false,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  last_seen_at timestamptz not null default now()
);

create table push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid references students(id) on delete cascade,
  admin_id     uuid references admins(id) on delete cascade,
  endpoint     text not null unique check (length(endpoint) <= 1000),
  p256dh       text not null check (length(p256dh) <= 200),
  auth         text not null check (length(auth) <= 100),
  created_at   timestamptz not null default now(),
  last_sent_at timestamptz,
  check ((student_id is null) <> (admin_id is null))
);
create index push_student_idx on push_subscriptions (student_id);

create table push_log (
  key     text primary key,
  sent_at timestamptz not null default now()
);

create table rate_limits (
  key          text primary key,
  window_start timestamptz not null,
  count        int not null
);

create table audit_log (
  id          bigserial primary key,
  actor_type  text not null check (actor_type in ('ADMIN','STUDENT','SYSTEM')),
  actor_id    text,
  action      text not null,
  entity      text not null,
  entity_id   text,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index audit_created_idx on audit_log (created_at desc);

create table health_check (id smallint primary key check (id = 1), note text not null default 'ok');
insert into health_check (id) values (1);

create table system_status (
  key             text primary key,
  ok              boolean,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  detail          text,
  updated_at      timestamptz not null default now()
);

-- Supabase: nada acessível pela API REST pública. Só o Worker fala com o banco.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
    execute 'revoke all on all sequences in schema public from anon';
    execute 'alter default privileges in schema public revoke all on tables from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema public from authenticated';
    execute 'revoke all on all sequences in schema public from authenticated';
    execute 'alter default privileges in schema public revoke all on tables from authenticated';
  end if;
end $$;
