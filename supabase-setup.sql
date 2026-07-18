-- ============================================================
-- Habit Tracker — Supabase schema reference
-- ============================================================
-- Idempotent: safe to paste into the SQL Editor and run again at
-- any time (e.g. after adding a new column here) without dropping
-- tables or losing existing user data. Nothing here ever DROPs a
-- table — new columns are added via "add column if not exists",
-- policies are replaced via "drop policy if exists" + "create policy".
-- ============================================================

-- One row per user — whole-state JSON blob (matches client shape)
create table if not exists public.tracker_data (
  user_id      uuid primary key
                 references auth.users(id) on delete cascade
                 default auth.uid(),
  habits       text,
  logs         text,
  todos        text,
  plans        text,
  custom_foods text,
  active_plan  text,
  updated_at   timestamptz not null default now()
);

-- One row per user per day
create table if not exists public.tracker_nutrition (
  user_id    uuid not null
               references auth.users(id) on delete cascade
               default auth.uid(),
  date       date not null,
  data       text,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- Catches up older setups that predate a given column (safe no-op otherwise)
alter table public.tracker_data add column if not exists custom_foods text;

alter table public.tracker_data      enable row level security;
alter table public.tracker_nutrition enable row level security;

drop policy if exists "select own tracker_data" on public.tracker_data;
create policy "select own tracker_data" on public.tracker_data
  for select using (auth.uid() = user_id);
drop policy if exists "insert own tracker_data" on public.tracker_data;
create policy "insert own tracker_data" on public.tracker_data
  for insert with check (auth.uid() = user_id);
drop policy if exists "update own tracker_data" on public.tracker_data;
create policy "update own tracker_data" on public.tracker_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "delete own tracker_data" on public.tracker_data;
create policy "delete own tracker_data" on public.tracker_data
  for delete using (auth.uid() = user_id);

drop policy if exists "select own tracker_nutrition" on public.tracker_nutrition;
create policy "select own tracker_nutrition" on public.tracker_nutrition
  for select using (auth.uid() = user_id);
drop policy if exists "insert own tracker_nutrition" on public.tracker_nutrition;
create policy "insert own tracker_nutrition" on public.tracker_nutrition
  for insert with check (auth.uid() = user_id);
drop policy if exists "update own tracker_nutrition" on public.tracker_nutrition;
create policy "update own tracker_nutrition" on public.tracker_nutrition
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "delete own tracker_nutrition" on public.tracker_nutrition;
create policy "delete own tracker_nutrition" on public.tracker_nutrition
  for delete using (auth.uid() = user_id);

-- ============================================================
-- Dashboard settings this schema depends on (not SQL — check manually):
--
-- 1. Authentication -> Providers -> Email
--    "Confirm email" must be ON (require confirmation before login).
--
-- 2. Authentication -> URL Configuration
--    Site URL:      https://tracker.jklahn.com
--    Redirect URLs: https://tracker.jklahn.com
--                   http://localhost:5173   (or whatever you use for local testing)
--
-- 3. Default built-in SMTP has a low hourly send limit — for repeated
--    test signups, use Gmail "+" aliases (you+test1@gmail.com, you+test2@gmail.com, ...)
--    against your real inbox rather than creating throwaway addresses.
-- ============================================================
