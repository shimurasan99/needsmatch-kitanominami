create table public.attendance_responses (
  meeting_key text not null,
  member_key text not null,
  status text not null default '未定' check (status in ('参加','欠席','未定','キャンセル')),
  updated_at timestamptz not null default now(),
  primary key (meeting_key, member_key)
);

create table public.attendance_snapshots (
  meeting_key text primary key,
  guests jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.attendance_responses enable row level security;
alter table public.attendance_snapshots enable row level security;

-- 読み書きは共有パスワード認証済みのサーバーAPIから service role で行います。
