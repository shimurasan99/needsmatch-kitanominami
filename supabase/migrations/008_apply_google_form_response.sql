-- Apply one reviewed inbox response and its attendance in the same transaction.
create or replace function public.apply_google_form_response(
  p_source_id text, p_meeting_key text, p_meeting_date text, p_member_key text,
  p_expected_version timestamptz default null, p_expected_guests_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_payload jsonb; v_guests jsonb; v_guest_id text; v_result jsonb;
begin
  select payload into v_payload from public.shared_site_state
    where state_key = 'admin-form:' || p_source_id for update;
  if v_payload is null then raise exception 'Response missing'; end if;
  if v_payload ? 'applied' then return jsonb_build_object('alreadyApplied', true, 'applied', v_payload->'applied'); end if;
  if trim(coalesce(v_payload->>'name','')) = '' then raise exception 'Response name missing'; end if;
  if coalesce(v_payload->>'meetingDate','') <> '' and v_payload->>'meetingDate' <> p_meeting_date then raise exception 'Meeting date mismatch'; end if;
  if coalesce(p_member_key, '') <> '' then
    v_result := public.save_attendance_atomic(p_meeting_key,
      jsonb_build_object(p_member_key, '参加'), jsonb_build_object(p_member_key, p_expected_version), null, null);
    v_guest_id := '';
  else
    perform pg_advisory_xact_lock(hashtextextended('attendance:' || p_meeting_key, 0));
    select guests into v_guests from public.attendance_snapshots where meeting_key = p_meeting_key;
    v_guests := coalesce(v_guests, '[]'::jsonb);
    v_guest_id := 'google-' || p_source_id;
    if exists(select 1 from jsonb_array_elements(v_guests) g
      where g->>'id' <> v_guest_id
      and regexp_replace(g->>'name', '[[:space:]　]+', '', 'g') = regexp_replace(v_payload->>'name', '[[:space:]　]+', '', 'g')
      and coalesce(g->>'company','') = coalesce(v_payload->>'company','')) then
      raise exception using errcode = '23505', message = 'Guest already exists; review roster';
    end if;
    if not exists(select 1 from jsonb_array_elements(v_guests) g where g->>'id' = v_guest_id) then
      v_guests := v_guests || jsonb_build_array(jsonb_build_object(
        'id', v_guest_id, 'name', v_payload->>'name', 'company', coalesce(v_payload->>'company',''),
        'industry', coalesce(v_payload->>'industry',''), 'type',
        case when coalesce(v_payload->>'branchName','') not in ('','ゲスト（ゲスト参加は合計2回までです）','ゲスト') then '他支部' else '新規' end,
        'branchName', coalesce(v_payload->>'branchName',''), 'status', '参加'));
    end if;
    v_result := public.save_attendance_atomic(p_meeting_key, '{}'::jsonb, '{}'::jsonb, v_guests, p_expected_guests_at);
  end if;
  v_payload := v_payload || jsonb_build_object('applied', jsonb_build_object('meetingId', p_meeting_key,
    'memberId', coalesce(p_member_key,''), 'guestId', v_guest_id, 'at', clock_timestamp()));
  update public.shared_site_state set payload = v_payload, updated_at = clock_timestamp()
    where state_key = 'admin-form:' || p_source_id;
  return jsonb_build_object('applied', v_payload->'applied');
end;
$$;
revoke all on function public.apply_google_form_response(text,text,text,text,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.apply_google_form_response(text,text,text,text,timestamptz,timestamptz) to service_role;
