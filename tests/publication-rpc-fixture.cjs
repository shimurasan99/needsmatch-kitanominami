// In-memory behavioral double for migration 007; no live database connection.
function publishTableAssignment(state, input) {
  const fail = (code, message) => ({ data: null, error: { code, message } });
  if (!input.p_meeting_id || input.p_expected_draft_revision == null) return fail('22023', 'NM_TABLE_NOT_SAVED');
  const shared = state.get('shared_site_state') ?? [];
  const drafts = shared.find(row => row.state_key === 'table-assignment-drafts');
  let published = shared.find(row => row.state_key === 'table-assignments');
  const draft = drafts?.payload?.[input.p_meeting_id];
  const prior = published?.payload?.[input.p_meeting_id];
  if ((draft?.updatedAt ?? null) !== input.p_expected_draft_revision || (prior?.publishedAt ?? null) !== (input.p_expected_publication_revision ?? null)) return fail('P0001', 'NM_TABLE_CONFLICT');
  if (!Array.isArray(draft.tables)) return fail('22023', 'NM_TABLE_NOT_SAVED');
  if (!draft.tables.length) return fail('22023', 'NM_TABLE_EMPTY');
  if (draft.tables.some(table => !table || typeof table !== 'object' || Array.isArray(table) || !Array.isArray(table.seats))) return fail('22023', 'NM_TABLE_NOT_SAVED');
  const now = new Date(Math.max(Date.now(), published ? Date.parse(published.updated_at) + 1 : 0)).toISOString();
  const publication = { meetingId: input.p_meeting_id, tables: structuredClone(draft.tables), publishedAt: now, sourceUpdatedAt: draft.updatedAt };
  if (!published) { published = { state_key: 'table-assignments', payload: {}, updated_at: now }; shared.push(published); state.set('shared_site_state', shared); }
  published.payload[input.p_meeting_id] = publication;
  published.updated_at = now;
  return { data: { publication, updatedAt: now }, error: null };
}
module.exports = { publishTableAssignment };
