-- ============================================================
-- CUADRANTE APP - Schema de base de datos
-- Ejecutar en el SQL Editor de Supabase (supabase.com/dashboard)
-- ============================================================

-- 1. Configuración global
create table if not exists app_config (
  key text primary key,
  value text not null
);

-- 2. Trabajadores
create table if not exists workers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_name text not null,
  color text not null default '#3B82F6',
  rotation_pattern jsonb not null default '[]'::jsonb,
  is_active boolean default true,
  sort_order int default 0
);

-- 3. Overrides (vacaciones, AP, cambios manuales)
create table if not exists schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid references workers(id) on delete cascade not null,
  date date not null,
  shift_type text not null check (shift_type in ('M', 'T', 'D', 'vacation', 'AP')),
  notes text,
  created_at timestamptz default now(),
  unique(worker_id, date)
);

create index if not exists schedule_overrides_date_idx on schedule_overrides(date);
create index if not exists schedule_overrides_worker_date_idx on schedule_overrides(worker_id, date);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table app_config enable row level security;
alter table workers enable row level security;
alter table schedule_overrides enable row level security;

-- Lectura pública (sin autenticación)
create policy "public_read_config" on app_config for select using (true);
create policy "public_read_workers" on workers for select using (true);
create policy "public_read_overrides" on schedule_overrides for select using (true);

-- Escritura solo para usuarios autenticados (administradores)
create policy "admin_all_config" on app_config for all
  to authenticated using (true) with check (true);
create policy "admin_all_workers" on workers for all
  to authenticated using (true) with check (true);
create policy "admin_all_overrides" on schedule_overrides for all
  to authenticated using (true) with check (true);

-- ============================================================
-- Datos iniciales (seed)
-- ============================================================

-- Configuración inicial
insert into app_config (key, value) values
  ('cycle_start_date', '2026-06-01'),
  ('cycle_length_days', '28')
on conflict (key) do nothing;

-- Trabajadores iniciales con sus patrones de 28 días
-- Patrón: Semanas 1+2 (base) y Semanas 3+4 (M↔T invertido, D sin cambio)
insert into workers (name, display_name, color, rotation_pattern, is_active, sort_order) values
(
  'ALB',
  'ALB',
  '#EF4444',
  '["M","M","M","M","D","D","D","D","D","T","T","T","T","T","T","T","T","T","D","D","D","D","D","M","M","M","M","M"]',
  true,
  1
),
(
  'ALE.M.',
  'ALE.M.',
  '#8B5CF6',
  '["M","M","M","M","M","M","M","M","M","D","D","D","D","D","T","T","T","T","T","T","T","T","T","D","D","D","D","D"]',
  true,
  2
),
(
  'PEPI',
  'PEPI',
  '#10B981',
  '["T","T","T","D","D","D","D","D","T","M","M","M","M","M","M","M","M","D","D","D","D","D","M","T","T","T","T","T"]',
  true,
  3
),
(
  'IGN',
  'IGN',
  '#F59E0B',
  '["T","T","T","T","D","D","D","D","D","M","M","M","M","M","M","M","M","M","D","D","D","D","D","T","T","T","T","T"]',
  true,
  4
),
(
  'DIE',
  'DIE',
  '#3B82F6',
  '["D","D","D","T","T","T","T","T","M","T","T","T","D","D","D","D","D","M","M","M","M","M","T","M","M","M","D","D"]',
  true,
  5
)
on conflict (name) do nothing;
