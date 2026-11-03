-- Call of Survival: players' profiles and friend requests.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Also: Authentication -> Sign In / Providers: enable "Anonymous sign-ins" (guests), and Google / Facebook if wanted
-- (their client IDs and secrets come from Google Cloud / Meta for Developers), and under URL Configuration add the
-- redirect URL  http://127.0.0.1:43123/callback

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  public_id text unique not null,            -- the 8-digit ID shown on the player card, used to find friends
  name text not null default 'جندي',
  rating integer not null default 1000,
  tier text not null default 'فضي',
  last_seen timestamptz not null default now()
);

create table if not exists public.friend_requests (
  id bigint generated always as identity primary key,
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (from_id, to_id)
);

alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;

-- profiles: everyone signed in can read (to search by ID); each player writes only his own row
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- friend requests: the two players involved can see them; only the sender creates one (as himself);
-- only the receiver answers it
drop policy if exists "requests read own" on public.friend_requests;
create policy "requests read own" on public.friend_requests for select to authenticated using (auth.uid() = from_id or auth.uid() = to_id);
drop policy if exists "requests send" on public.friend_requests;
create policy "requests send" on public.friend_requests for insert to authenticated with check (auth.uid() = from_id and status = 'pending');
drop policy if exists "requests answer" on public.friend_requests;
create policy "requests answer" on public.friend_requests for update to authenticated using (auth.uid() = to_id) with check (auth.uid() = to_id);
