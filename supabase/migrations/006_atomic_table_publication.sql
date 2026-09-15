-- Publish only the saved database snapshot, checking both per-meeting revisions
-- under the same transaction locks. No existing seating payload is rewritten here.
create or replace function public.publish_table_assignment(
  p_meeting_id text,
  p_expected_draft_revision text,
  p_expected_publication_revision text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_drafts jsonb;
  v_publications jsonb;
  v_saved jsonb;
  v_publication jsonb;
  v_row_updated_at timestamptz;
  v_stamp timestamptz;
  v_revision text;
begin
  if p_meeting_id is null or length(p_meeting_id) = 0 or p_expected_draft_revision is null then
    raise exception using errcode = '22023', message = 'NM_TABLE_NOT_SAVED';
  end if;

  -- Deterministic lock order also serializes different meetings without dropping them.
  insert into public.shared_site_state(state_key, payload)
    values ('table-assignment-drafts', '{}'::jsonb) on conflict (state_key) do nothing;
  select payload into v_drafts from public.shared_site_state
    where state_key = 'table-assignment-drafts' for update;
  insert into public.shared_site_state(state_key, payload)
    values ('table-assignments', '{}'::jsonb) on conflict (state_key) do nothing;
  select payload, updated_at into v_publications, v_row_updated_at
    from public.shared_site_state where state_key = 'table-assignments' for update;

  v_saved := v_drafts -> p_meeting_id;
  if (v_saved ->> 'updatedAt') is distinct from p_expected_draft_revision
    or (v_publications -> p_meeting_id ->> 'publishedAt') is distinct from p_expected_publication_revision then
    raise exception using errcode = 'P0001', message = 'NM_TABLE_CONFLICT';
  end if;
  if jsonb_typeof(v_saved -> 'tables') is distinct from 'array' then
    raise exception using errcode = '22023', message = 'NM_TABLE_NOT_SAVED';
  end if;
  if not exists (select 1 from jsonb_array_elements(v_saved -> 'tables') t
    where case when jsonb_typeof(t -> 'seats') = 'array' then jsonb_array_length(t -> 'seats') > 0 else false end) then
    raise exception using errcode = '22023', message = 'NM_TABLE_EMPTY';
  end if;
  v_stamp := greatest(clock_timestamp(), v_row_updated_at + interval '1 millisecond');
  v_revision := to_char(v_stamp at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_publication := jsonb_build_object('meetingId', p_meeting_id, 'tables', v_saved -> 'tables',
    'publishedAt', v_revision, 'sourceUpdatedAt', p_expected_draft_revision);
  update public.shared_site_state
    set payload = jsonb_set(v_publications, array[p_meeting_id], v_publication, true), updated_at = v_stamp
    where state_key = 'table-assignments';
  return jsonb_build_object('publication', v_publication, 'updatedAt', v_stamp);
end;
$$;

revoke all on function public.publish_table_assignment(text, text, text) from public, anon, authenticated;
grant execute on function public.publish_table_assignment(text, text, text) to service_role;
