create extension if not exists "pgcrypto";

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name in ('管理者','主催','幹事','準役員','一般会員')),
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  member_no text not null unique,
  name text not null,
  kana text,
  email text,
  phone text,
  facebook_url text,
  instagram_url text,
  website_url text,
  industry text,
  major_industry text not null check (major_industry in ('サービス業（飲食・美容など）','保険・建築業','IT・販売業','その他')),
  profile_image_url text,
  bio text,
  position text not null default '一般会員' check (position in ('主催','幹事','準役員','一般会員')),
  is_table_leader boolean not null default false,
  status text not null default '在籍' check (status in ('在籍','休会','退会')),
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  role_id uuid not null references public.roles(id),
  created_at timestamptz not null default now()
);

create table public.monthly_meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  meeting_date date not null,
  start_time time not null,
  end_time time not null,
  venue_name text,
  venue_address text,
  note text,
  application_deadline date,
  status text not null default '下書き' check (status in ('下書き','確定','終了')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meeting_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.monthly_meetings(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  guest_name text,
  guest_company text,
  status text not null default '未定' check (status in ('参加','欠席','未定','ゲスト')),
  participant_type text not null default 'member' check (participant_type in ('member','guest')),
  created_at timestamptz not null default now(),
  check (member_id is not null or guest_name is not null)
);

create table public.table_assignments (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.monthly_meetings(id) on delete cascade,
  title text not null,
  is_published boolean not null default false,
  score integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.table_assignment_members (
  id uuid primary key default gen_random_uuid(),
  table_assignment_id uuid not null references public.table_assignments(id) on delete cascade,
  table_name text not null,
  member_id uuid references public.members(id) on delete cascade,
  guest_name text,
  is_leader boolean not null default false,
  sort_order integer not null default 0,
  check (member_id is not null or guest_name is not null)
);

create table public.messenger_threads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_url text not null,
  alt text,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.roles enable row level security;
alter table public.members enable row level security;
alter table public.users enable row level security;
alter table public.monthly_meetings enable row level security;
alter table public.meeting_participants enable row level security;
alter table public.table_assignments enable row level security;
alter table public.table_assignment_members enable row level security;
alter table public.messenger_threads enable row level security;
alter table public.gallery_images enable row level security;

create or replace function public.current_role_name()
returns text
language sql
security definer
set search_path = public
as $$
  select r.name from public.users u join public.roles r on r.id = u.role_id where u.auth_user_id = auth.uid()
$$;

create or replace function public.is_operator()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(public.current_role_name() in ('管理者','主催','幹事','準役員'), false)
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(public.current_role_name() = '管理者', false)
$$;

create policy "public visible members" on public.members for select using (is_visible = true and status = '在籍');
create policy "operators manage members" on public.members for all using (public.is_operator()) with check (public.is_operator());
create policy "public confirmed meetings" on public.monthly_meetings for select using (status in ('確定','終了'));
create policy "operators manage meetings" on public.monthly_meetings for all using (public.is_operator()) with check (public.is_operator());
create policy "operators manage participants" on public.meeting_participants for all using (public.is_operator()) with check (public.is_operator());
create policy "members view published assignments" on public.table_assignments for select using (is_published = true or public.is_operator());
create policy "operators manage assignments" on public.table_assignments for all using (public.is_operator()) with check (public.is_operator());
create policy "members view assignment seats" on public.table_assignment_members for select using (
  exists (select 1 from public.table_assignments ta where ta.id = table_assignment_id and (ta.is_published = true or public.is_operator()))
);
create policy "operators manage assignment seats" on public.table_assignment_members for all using (public.is_operator()) with check (public.is_operator());
create policy "members view visible threads" on public.messenger_threads for select using (is_visible = true and auth.uid() is not null);
create policy "operators manage threads" on public.messenger_threads for all using (public.is_operator()) with check (public.is_operator());
create policy "public visible gallery" on public.gallery_images for select using (is_visible = true);
create policy "operators manage gallery" on public.gallery_images for all using (public.is_operator()) with check (public.is_operator());
create policy "users self read" on public.users for select using (auth_user_id = auth.uid() or public.is_admin());
create policy "admins manage users" on public.users for all using (public.is_admin()) with check (public.is_admin());
create policy "authenticated read roles" on public.roles for select using (auth.uid() is not null);
create policy "admins manage roles" on public.roles for all using (public.is_admin()) with check (public.is_admin());
