-- ============================================================
-- HỒ SƠ MẬT: AI NGOẠI PHẠM — Supabase Database Setup
-- Chạy toàn bộ script này trong Supabase SQL Editor
-- ============================================================

-- 1. Bảng profiles (extend auth.users)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  username text,
  avatar_url text,
  total_wins int not null default 0,
  total_games int not null default 0,
  created_at timestamp with time zone default now()
);

-- Tự động tạo profile khi user đăng ký
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- 2. Bảng rooms
create table if not exists rooms (
  id uuid default gen_random_uuid() primary key,
  code text unique not null,
  host_id uuid references profiles(id) on delete cascade not null,
  subjects text[] default '{}',
  difficulty text not null default 'medium',
  max_players int not null default 4,
  status text not null default 'waiting',
  case_data jsonb,  -- Dữ liệu vụ án do Gemini Tầng 1 sinh ra
  created_at timestamp with time zone default now(),
  constraint rooms_difficulty_check check (difficulty in ('easy', 'medium', 'hard')),
  constraint rooms_status_check check (status in ('waiting', 'playing', 'finished')),
  constraint rooms_max_players_check check (max_players between 2 and 5)
);

-- Thêm cột nếu chạy lại trên DB đã tồn tại
alter table rooms add column if not exists case_data jsonb;

-- 3. Bảng room_members
create table if not exists room_members (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references rooms(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  nickname text not null,
  is_host boolean not null default false,
  joined_at timestamp with time zone default now(),
  unique(room_id, user_id)
);

-- ============================================================
-- RPC: tạo phòng + host member trong 1 transaction (giảm round-trip)
-- ============================================================
create or replace function create_room_with_host(
  p_host_id uuid,
  p_nickname text,
  p_difficulty text,
  p_max_players int
)
returns table(room_id uuid, room_code text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_room_id uuid;
  v_code text;
  v_attempt int := 0;
begin
  if auth.uid() is null or auth.uid() <> p_host_id then
    raise exception 'Unauthorized';
  end if;

  if p_nickname is null or length(trim(p_nickname)) = 0 then
    raise exception 'Nickname is required';
  end if;

  if p_difficulty not in ('easy', 'medium', 'hard') then
    raise exception 'Invalid difficulty';
  end if;

  if p_max_players < 2 or p_max_players > 5 then
    raise exception 'Invalid max_players';
  end if;

  while v_attempt < 8 loop
    v_attempt := v_attempt + 1;

    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

    begin
      insert into rooms (code, host_id, subjects, difficulty, max_players, status)
      values (v_code, p_host_id, array[]::text[], p_difficulty, p_max_players, 'waiting')
      returning id into v_room_id;

      insert into room_members (room_id, user_id, nickname, is_host)
      values (v_room_id, p_host_id, trim(p_nickname), true);

      room_id := v_room_id;
      room_code := v_code;
      return next;
      return;
    exception
      when unique_violation then
        continue;
    end;
  end loop;

  raise exception 'Unable to generate unique room code';
end;
$$;

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

alter table profiles enable row level security;
alter table rooms enable row level security;
alter table room_members enable row level security;

-- profiles: ai cũng đọc được, chỉ chính mình mới sửa
drop policy if exists "profiles_select" on profiles;
drop policy if exists "profiles_insert" on profiles;
drop policy if exists "profiles_update" on profiles;
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_insert" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on profiles for update using (auth.uid() = id);

-- rooms: ai cũng đọc được, chỉ host mới update/delete
drop policy if exists "rooms_select" on rooms;
drop policy if exists "rooms_insert" on rooms;
drop policy if exists "rooms_update" on rooms;
drop policy if exists "rooms_delete" on rooms;
create policy "rooms_select" on rooms for select using (true);
create policy "rooms_insert" on rooms for insert with check (auth.uid() = host_id);
create policy "rooms_update" on rooms for update using (auth.uid() = host_id);
create policy "rooms_delete" on rooms for delete using (auth.uid() = host_id);

-- room_members: member trong phòng đọc được, user tự thêm/sửa/xóa mình
drop policy if exists "room_members_select" on room_members;
drop policy if exists "room_members_insert" on room_members;
drop policy if exists "room_members_update" on room_members;
drop policy if exists "room_members_delete" on room_members;
create policy "room_members_select" on room_members for select using (true);
create policy "room_members_insert" on room_members for insert with check (auth.uid() = user_id);
create policy "room_members_update" on room_members for update using (auth.uid() = user_id);
create policy "room_members_delete" on room_members for delete using (auth.uid() = user_id);

-- ============================================================
-- Realtime subscriptions
-- ============================================================
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table room_members;

-- ============================================================
-- 4. Bảng game_messages (shared realtime chat trong phòng chơi)
-- ============================================================
create table if not exists game_messages (
  id uuid default gen_random_uuid() primary key,
  room_code text not null,
  role text not null,
  sender_nickname text,
  content text not null,
  created_at timestamptz default now(),
  constraint game_messages_role_check check (role in ('user', 'ai'))
);

alter table game_messages enable row level security;

drop policy if exists "game_messages_select" on game_messages;
drop policy if exists "game_messages_insert" on game_messages;
create policy "game_messages_select" on game_messages for select using (true);
create policy "game_messages_insert" on game_messages for insert with check (auth.uid() is not null);

alter publication supabase_realtime add table game_messages;

create index if not exists game_messages_room_code_idx on game_messages(room_code);

-- ============================================================
-- Backfill: tạo profile cho các user đã đăng ký trước khi schema được push
-- ============================================================
insert into public.profiles (id, username, avatar_url)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
  u.raw_user_meta_data->>'avatar_url'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

