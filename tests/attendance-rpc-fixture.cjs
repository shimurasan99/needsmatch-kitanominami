// Synchronous, copy-on-write model used only by local browser/API tests.
exports.saveAttendance = function saveAttendance(state, args, failAfterStatuses = false) {
  const rows = structuredClone(state.get('attendance_responses') ?? []);
  const snapshots = structuredClone(state.get('attendance_snapshots') ?? []);
  const meeting = args.p_meeting_key;
  const statuses = args.p_statuses;
  const versions = args.p_expected_versions;
  const conflict = () => ({ data: null, error: { code: '40001', message: 'Attendance conflict' } });
  for (const id of Object.keys(statuses)) {
    const actual = rows.find(row => row.meeting_key === meeting && row.member_key === id)?.updated_at ?? null;
    if (actual !== versions[id]) return conflict();
  }
  const snapshot = snapshots.find(row => row.meeting_key === meeting);
  if (args.p_guests !== null && (snapshot?.updated_at ?? null) !== args.p_expected_guests_at) return conflict();
  const nextTime = old => new Date(Math.max(Date.now(), old ? Date.parse(old) + 1 : 0)).toISOString();
  for (const [id, status] of Object.entries(statuses)) {
    const existing = rows.find(row => row.meeting_key === meeting && row.member_key === id);
    const row = { meeting_key: meeting, member_key: id, status, updated_at: nextTime(existing?.updated_at) };
    if (existing) Object.assign(existing, row); else rows.push(row);
  }
  if (failAfterStatuses) return { data: null, error: { code: 'XX000', message: 'Injected guest failure' } };
  if (args.p_guests !== null) {
    const row = { meeting_key: meeting, guests: args.p_guests, updated_at: nextTime(snapshot?.updated_at) };
    if (snapshot) Object.assign(snapshot, row); else snapshots.push(row);
  }
  state.set('attendance_responses', rows);
  state.set('attendance_snapshots', snapshots);
  const selected = rows.filter(row => row.meeting_key === meeting);
  const finalSnapshot = snapshots.find(row => row.meeting_key === meeting);
  return { data: {
    statuses: Object.fromEntries(selected.map(row => [row.member_key, row.status])),
    versions: Object.fromEntries(selected.map(row => [row.member_key, row.updated_at])),
    guests: finalSnapshot?.guests ?? [], guestsUpdatedAt: finalSnapshot?.updated_at ?? null,
    updatedAt: [...selected.map(row => row.updated_at), finalSnapshot?.updated_at].filter(Boolean).sort().at(-1) ?? null
  }, error: null };
};
