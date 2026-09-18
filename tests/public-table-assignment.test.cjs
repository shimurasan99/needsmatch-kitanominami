const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(relative, mocks = {}) {
  const file = path.join(__dirname, '..', relative), mod = new Module(file, module);
  mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
  return mod.exports;
}
const helper = load('lib/table-assignment/public-snapshot.ts');
const record = load('lib/data/meeting-record.ts');
const meeting = { id: 'm', title: 'Meeting', date: '2026-09-20', startTime: '18:00', endTime: '20:00', venueName: 'Venue', venueAddress: 'PRIVATE ADDRESS', note: 'PRIVATE NOTE', applicationDeadline: '2026-09-18', status: '確定' };
const publication = { meetingId: 'm', publishedAt: '2026-09-18T00:00:00Z', sourceUpdatedAt: 'PRIVATE REVISION', tables: [{ tableName: 'A', seats: [
  { member: { name: 'Member', industry: 'Industry', id: 'PRIVATE ID', memberNo: 'PRIVATE NUMBER', email: 'PRIVATE EMAIL', phone: 'PRIVATE PHONE', bio: 'PRIVATE BIO' }, isLeader: true },
  { guestName: 'Guest', guestCompany: 'Company', privateNote: 'PRIVATE NOTE', isLeader: false },
  { guestName: 'Guest2', isLeader: false }
] }] };
function setup({ row = record.meetingToRow(meeting), payload = { m: publication }, meetingError = false, publicationError = false, configured = true, sharedMissing = false } = {}) {
  const reads = [];
  const db = { from(table) {
    const q = { select() { return q; }, eq(key, value) { reads.push([table, key, value]); return q; }, async maybeSingle() {
      if (table === 'managed_meetings') return { data: row, error: meetingError ? { message: 'PRIVATE DB ERROR' } : null };
      assert.equal(table, 'shared_site_state');
      assert.deepEqual(reads.at(-1), ['shared_site_state', 'state_key', 'table-assignments']);
      return { data: sharedMissing ? null : { payload }, error: publicationError ? { message: 'PRIVATE DB ERROR' } : null };
    } }; return q;
  } };
  const route = load('app/api/meetings/[id]/public-table-assignment/route.ts', {
    '@/lib/supabase/server': { createSupabaseServerClient: () => configured ? db : null },
    '@/lib/data/mock': { meetings: [meeting] }, '@/lib/data/meeting-record': record,
    '@/lib/table-assignment/public-snapshot': helper
  });
  return { reads, get: (id = 'm') => route.GET(new Request('http://localhost/no-cookie'), { params: Promise.resolve({ id }) }) };
}
test('anonymous published DTO exposes only requested public snapshot and no sensitive fields', async () => {
  const h = setup({ payload: { m: publication, another: { secret: 'PRIVATE OTHER' } } });
  const response = await h.get();
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const dto = await response.json();
  assert.deepEqual(dto.meeting, { id: 'm', title: 'Meeting', date: '2026-09-20', startTime: '18:00', endTime: '20:00', venueName: 'Venue' });
  assert.deepEqual(dto.publication, { publishedAt: publication.publishedAt, tables: [{ tableName: 'A', seats: [{ name: 'Member', description: 'Industry', isLeader: true }, { name: 'Guest', description: 'Company', isLeader: false }, { name: 'Guest2', description: 'ゲスト', isLeader: false }] }] });
  assert.doesNotMatch(JSON.stringify(dto), /PRIVATE|memberNo|sourceUpdatedAt|guestName/);
  assert.equal(h.reads.length, 2);
});
test('managed draft hides mock fallback and absent meetings never query publications', async () => {
  for (const [h, id] of [[setup({ row: { ...record.meetingToRow(meeting), status: '下書き' } }), 'm'], [setup({ row: null }), 'missing']]) {
    const response = await h.get(id);
    assert.equal(response.status, 404); assert.equal(h.reads.length, 1);
  }
});
test('unpublished response is null; mock fallback and empty-seat published tables are supported', async () => {
  const unpublished = await (await setup({ payload: {}, row: null }).get()).json();
  assert.equal(unpublished.publication, null); assert.equal(unpublished.meeting.id, 'm');
  assert.equal((await (await setup({ sharedMissing: true }).get()).json()).publication, null);
  const empty = { ...publication, tables: [{ tableName: 'A', seats: [] }] };
  assert.deepEqual((await (await setup({ payload: { m: empty } }).get()).json()).publication.tables, empty.tables);
  const overridden = await (await setup({ row: { ...record.meetingToRow(meeting), title: 'Managed title', status: '終了' } }).get()).json();
  assert.equal(overridden.meeting.title, 'Managed title');
});
test('database errors and invalid records fail closed without leaking details or drafts', async () => {
  const cases = [setup({ meetingError: true, row: null }), setup({ publicationError: true }), setup({ payload: [] }), setup({ payload: { m: null } }), setup({ row: { ...record.meetingToRow(meeting), start_time: null } }),
    ...[{ ...publication, meetingId: 'other' }, { ...publication, publishedAt: 'invalid' }, { ...publication, tables: [] }, { ...publication, tables: [{ tableName: 'A', seats: [{ guestName: 'Guest', isLeader: 'yes' }] }] }].map(value => setup({ payload: { m: value } }))];
  for (const h of cases) {
    const response = await h.get(); assert.equal(response.status, 500); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { error: '公開情報を読み込めませんでした。' });
  }
  assert.equal((await setup({ configured: false }).get()).status, 503);
});
