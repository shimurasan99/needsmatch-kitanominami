create table if not exists public.shared_site_state (
  state_key text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.shared_site_state enable row level security;

comment on table public.shared_site_state is
  'Server-managed shared state for members, deals, gallery, threads and published table assignments.';
