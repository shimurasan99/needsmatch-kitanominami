-- No existing data is changed by this migration. Apply before deploying the RPC client.
create or replace function public.save_attendance_atomic(
  p_meeting_key text,
  p_statuses jsonb,
  p_expected_versions jsonb,
  p_guests jsonb default null,
  p_expected_guests_at timestamptz default null
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  item record;
  actual_version timestamptz;
  expected_version timestamptz;
  result jsonb;
begin
  if p_meeting_key is null or btrim(p_meeting_key) = ''
     or p_statuses is null or jsonb_typeof(p_statuses) <> 'object'
     or p_expected_versions is null or jsonb_typeof(p_expected_versions) <> 'object' then
    raise exception using errcode = '22023', message = 'Invalid attendance payload';
  end if;
  -- All writers through this function serialize for this meeting, including new rows.
  perform pg_advisory_xact_lock(hashtextextended('attendance:' || p_meeting_key, 0));

  for item in select key, value from jsonb_each(p_statuses) loop
    if btrim(item.key) = '' or jsonb_typeof(item.value) <> 'string'
       or item.value #>> '{}' not in ('参加', '欠席', '未定', 'キャンセル')
       or not (p_expected_versions ? item.key)
       or jsonb_typeof(p_expected_versions -> item.key) not in ('string', 'null') then
      raise exception using errcode = '22023', message = 'Invalid attendance revision or status';
    end if;
    expected_version := (p_expected_versions ->> item.key)::timestamptz;
    select updated_at into actual_version from public.attendance_responses
      where meeting_key = p_meeting_key and member_key = item.key for update;
    if actual_version is distinct from expected_version then
      raise exception using errcode = '40001', message = 'Attendance changed; reload before saving';
    end if;
  end loop;

  if p_guests is not null then
    if jsonb_typeof(p_guests) <> 'array' then
      raise exception using errcode = '22023', message = 'Invalid guest list';
    end if;
    if exists (select 1 from jsonb_array_elements(p_guests) guest
      where jsonb_typeof(guest) <> 'object' or coalesce(guest ->> 'id', '') = ''
        or coalesce(btrim(guest ->> 'name'), '') = '') then
      raise exception using errcode = '22023', message = 'Invalid guest entry';
    end if;
    select updated_at into actual_version from public.attendance_snapshots
      where meeting_key = p_meeting_key for update;
    if actual_version is distinct from p_expected_guests_at then
      raise exception using errcode = '40001', message = 'Guests changed; reload before saving';
    end if;
  end if;

  -- All revisions were checked first. Any later error rolls back both tables.
  for item in select key, value from jsonb_each_text(p_statuses) loop
    insert into public.attendance_responses(meeting_key, member_key, status, updated_at)
      values (p_meeting_key, item.key, item.value, clock_timestamp())
    on conflict (meeting_key, member_key) do update
      set status = excluded.status,
          updated_at = greatest(clock_timestamp(), attendance_responses.updated_at + interval '1 microsecond');
  end loop;
  if p_guests is not null then
    insert into public.attendance_snapshots(meeting_key, guests, updated_at)
      values (p_meeting_key, p_guests, clock_timestamp())
    on conflict (meeting_key) do update
      set guests = excluded.guests,
          updated_at = greatest(clock_timestamp(), attendance_snapshots.updated_at + interval '1 microsecond');
  end if;

  select jsonb_build_object(
    'statuses', coalesce((select jsonb_object_agg(member_key, status) from public.attendance_responses where meeting_key = p_meeting_key), '{}'::jsonb),
    'versions', coalesce((select jsonb_object_agg(member_key, updated_at) from public.attendance_responses where meeting_key = p_meeting_key), '{}'::jsonb),
    'guests', coalesce((select guests from public.attendance_snapshots where meeting_key = p_meeting_key), '[]'::jsonb),
    'guestsUpdatedAt', (select updated_at from public.attendance_snapshots where meeting_key = p_meeting_key),
    'updatedAt', (select max(updated_at) from (
      select updated_at from public.attendance_responses where meeting_key = p_meeting_key
      union all select updated_at from public.attendance_snapshots where meeting_key = p_meeting_key
    ) revisions)
  ) into result;
  return result;
end;
$$;

revoke all on function public.save_attendance_atomic(text, jsonb, jsonb, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.save_attendance_atomic(text, jsonb, jsonb, jsonb, timestamptz) to service_role;
