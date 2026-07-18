create table public.managed_meetings (
  meeting_key text primary key,
  title text not null,
  meeting_date date not null,
  start_time time not null,
  end_time time not null,
  venue_name text not null default '',
  venue_address text not null default '',
  note text not null default '',
  application_deadline date not null,
  status text not null default '下書き' check (status in ('下書き','確定','終了')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.managed_meetings enable row level security;

insert into public.managed_meetings
  (meeting_key, title, meeting_date, start_time, end_time, venue_name, venue_address, note, application_deadline, status)
values
  ('meeting-2026-08', '2026年8月 北のみなみ月例会', '2026-08-21', '16:00', '18:00', '会場調整中', '', '', '2026-08-18', '確定'),
  ('meeting-2026-09', '2026年9月 北のみなみ月例会', '2026-09-18', '16:00', '18:00', '会場調整中', '', '', '2026-09-15', '確定'),
  ('meeting-2026-10', '2026年10月 北のみなみ月例会', '2026-10-16', '16:00', '18:00', '会場調整中', '', '', '2026-10-13', '確定'),
  ('meeting-2026-11', '2026年11月 北のみなみ月例会', '2026-11-20', '16:00', '18:00', '会場調整中', '', '', '2026-11-17', '確定'),
  ('meeting-2026-12', '2026年12月 北のみなみ月例会', '2026-12-18', '16:00', '18:00', '会場調整中', '', '', '2026-12-15', '確定')
on conflict (meeting_key) do update set
  title = excluded.title,
  meeting_date = excluded.meeting_date,
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  venue_name = excluded.venue_name,
  venue_address = excluded.venue_address,
  application_deadline = excluded.application_deadline,
  status = excluded.status,
  updated_at = now();
