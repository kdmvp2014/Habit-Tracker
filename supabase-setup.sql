-- ============================================================
-- Habit Tracker — Supabase Auth Migration
-- ============================================================
-- You already ran an earlier version of this script (without the
-- custom_foods column). Just run this ONE line to catch up — no
-- need to drop/recreate anything again:
--
--   alter table public.tracker_data add column if not exists custom_foods text;
--
-- Everything below is the full setup script, kept for reference /
-- for setting this up from scratch on a fresh project.
-- ============================================================

drop table if exists public.tracker_data cascade;
drop table if exists public.tracker_nutrition cascade;

-- One row per user — whole-state JSON blob (matches client shape)
create table public.tracker_data (
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
create table public.tracker_nutrition (
  user_id    uuid not null
               references auth.users(id) on delete cascade
               default auth.uid(),
  date       date not null,
  data       text,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.tracker_data      enable row level security;
alter table public.tracker_nutrition enable row level security;

create policy "select own tracker_data" on public.tracker_data
  for select using (auth.uid() = user_id);
create policy "insert own tracker_data" on public.tracker_data
  for insert with check (auth.uid() = user_id);
create policy "update own tracker_data" on public.tracker_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own tracker_data" on public.tracker_data
  for delete using (auth.uid() = user_id);

create policy "select own tracker_nutrition" on public.tracker_nutrition
  for select using (auth.uid() = user_id);
create policy "insert own tracker_nutrition" on public.tracker_nutrition
  for insert with check (auth.uid() = user_id);
create policy "update own tracker_nutrition" on public.tracker_nutrition
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own tracker_nutrition" on public.tracker_nutrition
  for delete using (auth.uid() = user_id);

-- ============================================================
-- After running this, also check (Dashboard, not SQL):
--
-- 1. Authentication -> Providers -> Email
--    "Confirm email" must be ON (require confirmation before login).
--
-- 2. Authentication -> URL Configuration
--    Site URL:      https://tracker.jklahn.com
--    Redirect URLs: https://tracker.jklahn.com
--                   http://localhost:8080   (or whatever you use for local testing)
--
-- 3. Default built-in SMTP has a low hourly send limit — for repeated
--    test signups, use Gmail "+" aliases (you+test1@gmail.com, you+test2@gmail.com, ...)
--    against your real inbox rather than creating throwaway addresses.
-- ============================================================
