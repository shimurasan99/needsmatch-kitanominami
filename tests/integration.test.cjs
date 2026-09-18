// Run with: node --test tests/integration.test.cjs
// Executes the real route handlers, signed sessions, and Next Request/Response classes.
// The in-memory Supabase double implements unique keys and atomic revision filters;
// these tests never contact or alter the production database.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { NextRequest } = require('next/server');
const { saveAttendance } = require('./attendance-rpc-fixture.cjs');
const { publishTableAssignment } = require('./publication-rpc-fixture.cjs');

process.env.AUTH_SESSION_SECRET = 'integration-test-only-session-secret-not-used-outside-tests';
process.env.ADMIN_SHARED_PASSWORD = 'integration-admin-password';
process.env.MEMBER_PAGE_PASSWORD = 'integration-member-password';

function load(relative, mocks = {}) {
  const filename = path.join(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.paths = module.paths;
  loaded.require = (id) => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, filename);
  return loaded.exports;
}
const auth = load('lib/auth.ts');
const meetingRecord = load('lib/data/meeting-record.ts');

class Database {
  constructor() { this.tables = new Map(); this.failure = null; }
  from(table) { if (!this.tables.has(table)) this.tables.set(table, []); return new Query(this, table); }
  rows(table) { return structuredClone(this.tables.get(table) ?? []); }
  async rpc(name, args) {
    if (name === 'publish_table_assignment') return publishTableAssignment(this.tables, args);
    assert.equal(name, 'save_attendance_atomic'); return saveAttendance(this.tables, args, this.failAttendanceAfterStatuses);
  }
}
class Query {
  constructor(database, table) { this.database = database; this.table = table; this.action = 'read'; this.filters = []; }
  select() { return this; }
  order(column) { this.orderColumn = column; return this; }
  eq(column, value) { this.filters.push((row) => row[column] === value); return this; }
  neq(column, value) { this.filters.push((row) => row[column] !== value); return this; }
  insert(value) { this.action = 'insert'; this.value = value; return this; }
  update(value) { this.action = 'update'; this.value = value; return this; }
  upsert(value, options = {}) { this.action = 'upsert'; this.value = value; this.conflictColumns = options.onConflict?.split(','); return this; }
  maybeSingle() { this.one = true; return this; }
  single() { this.one = true; return this; }
  then(resolve, reject) { return Promise.resolve().then(() => this.execute()).then(resolve, reject); }
  execute() {
    if (this.database.failure) return { data: null, error: this.database.failure };
    const rows = this.database.tables.get(this.table);
    const primary = this.conflictColumns ?? (this.table === 'shared_site_state' ? ['state_key'] : this.table === 'managed_meetings' ? ['meeting_key'] : this.table === 'attendance_responses' ? ['meeting_key', 'member_key'] : ['meeting_key']);
    let result;
    if (this.action === 'insert' || this.action === 'upsert') {
      const incoming = Array.isArray(this.value) ? this.value : [this.value];
      if (this.action === 'insert' && incoming.some((row) => rows.some((existing) => primary.every((key) => existing[key] === row[key])))) return { data: null, error: { code: '23505' } };
      result = incoming.map((row) => {
        const existing = this.action === 'upsert' && rows.find((item) => primary.every((key) => item[key] === row[key]));
        if (existing) { Object.assign(existing, structuredClone(row)); return existing; }
        const added = structuredClone(row); rows.push(added); return added;
      });
    } else {
      result = rows.filter((row) => this.filters.every((matches) => matches(row)));
      if (this.action === 'update') result.forEach((row) => Object.assign(row, structuredClone(this.value)));
    }
    if (this.orderColumn) result.sort((a, b) => String(a[this.orderColumn]).localeCompare(String(b[this.orderColumn])));
    return { data: structuredClone(this.one ? result[0] ?? null : result), error: null };
  }
}
function routes(database) {
  const mocks = {
    '@/lib/supabase/server': { createSupabaseServerClient: () => database },
    '@/lib/auth': auth, '@/lib/data/meeting-record': meetingRecord,
    '@/lib/data/mock': { meetings: [{ ...fixtureMeeting, id: 'seed-meeting', title: 'Initial confirmed meeting' }] }
  };
  return {
    state: load('app/api/site-state/[key]/route.ts', mocks),
    meetings: load('app/api/meetings/route.ts', mocks),
    meeting: load('app/api/meetings/[id]/route.ts', mocks),
    attendance: load('app/api/meetings/[id]/attendance/route.ts', mocks),
    publication: load('app/api/meetings/[id]/table-assignment-publication/route.ts', mocks),
    login: load('app/api/login/route.ts', mocks)
  };
}
function request(method = 'GET', body, cookie, version) {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  if (version) headers.set('If-Match', version);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  return new NextRequest('http://localhost:3000/api/test', { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function adminCookie(login) {
  const response = await login.POST(new Request('http://localhost:3000/api/login', {
    method: 'POST', body: new URLSearchParams({ password: process.env.ADMIN_SHARED_PASSWORD, redirect: '/admin/meetings' })
  }));
  assert.equal(response.status, 303);
  assert.equal(new URL(response.headers.get('location')).pathname, '/admin/meetings');
  assert.match(response.headers.get('set-cookie'), /HttpOnly/i);
  return response.headers.get('set-cookie').split(';')[0];
}
const fixtureMeeting = { id: 'september', title: '9月定例会', date: '2026-09-20', startTime: '18:00', endTime: '20:00', venueName: '会場', venueAddress: '東京都', note: '', applicationDeadline: '2026-09-18', status: '確定' };

test('saved empty-seat tables publish after the final absence, preserving history and CAS protections', async () => {
  const db = new Database();
  const revision = '2026-09-18T01:00:00.000Z';
  const tables = [{ tableName: 'Aテーブル', seats: [] }, { tableName: 'Bテーブル', seats: [] }];
  const history = { july: { tables: [{ tableName: 'A', seats: [{ guest: { name: 'July guest' } }] }], publishedAt: revision }, august: { tables: [], publishedAt: revision } };
  db.tables.set('shared_site_state', [
    { state_key: 'table-assignment-drafts', payload: { september: { tables, updatedAt: revision } }, updated_at: revision },
    { state_key: 'table-assignments', payload: structuredClone(history), updated_at: revision }
  ]);
  const { publication, state, login } = routes(db);
  const admin = await adminCookie(login);
  const member = `nm_member_auth=${await auth.createSessionToken('member')}`;
  const params = { params: Promise.resolve({ id: 'september' }) };
  const body = { expectedSavedRevision: revision, expectedPublishedRevision: null };
  for (const cookie of [undefined, member]) assert.equal((await publication.POST(request('POST', body, cookie), params)).status, 401);
  const beforeDraft = db.rows('shared_site_state')[0];
  const response = await publication.POST(request('POST', body, admin), params);
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.deepEqual(saved.publication.tables, tables);
  const shared = await (await state.GET(request('GET', undefined, member), { params: Promise.resolve({ key: 'table-assignments' }) })).json();
  assert.deepEqual(shared.payload.september, saved.publication);
  assert.deepEqual(shared.payload.july, history.july);
  assert.deepEqual(shared.payload.august, history.august);
  assert.deepEqual(db.rows('shared_site_state')[0], beforeDraft);
  const published = db.rows('shared_site_state');
  assert.equal((await publication.POST(request('POST', body, admin), params)).status, 409);
  assert.equal((await publication.POST(request('POST', { ...body, expectedSavedRevision: '2026-09-17T00:00:00.000Z', expectedPublishedRevision: saved.publication.publishedAt }, admin), params)).status, 409);
  assert.deepEqual(db.rows('shared_site_state'), published);
});

test('publication rejects zero tables and malformed table seat arrays without changing history', async () => {
  const revision = '2026-09-18T01:00:00.000Z';
  const admin = `nm_admin_auth=${await auth.createSessionToken('admin')}`;
  for (const tables of [undefined, null, {}, [], [null], [{}], [{ seats: null }], [{ seats: [] }, { seats: 'invalid' }]]) {
    const db = new Database();
    db.tables.set('shared_site_state', [
      { state_key: 'table-assignment-drafts', payload: { september: { tables, updatedAt: revision } }, updated_at: revision },
      { state_key: 'table-assignments', payload: { july: { tables: [], publishedAt: revision } }, updated_at: revision }
    ]);
    const before = db.rows('shared_site_state');
    const { publication } = routes(db);
    const response = await publication.POST(request('POST', { expectedSavedRevision: revision, expectedPublishedRevision: null }, admin), { params: Promise.resolve({ id: 'september' }) });
    assert.equal(response.status, 400, JSON.stringify(tables));
    assert.deepEqual(db.rows('shared_site_state'), before);
  }
});

test('two separately logged-in admins can create/update shared records; stale writers cannot erase newer data', async () => {
  const db = new Database();
  const { state, login } = routes(db);
  const a = await adminCookie(login);
  const b = await adminCookie(login);
  const params = { params: Promise.resolve({ key: 'members' }) };
  const empty = await state.GET(request(), params);
  assert.equal(empty.headers.get('cache-control'), 'no-store');
  assert.equal((await empty.json()).payload, null);
  const created = await state.PUT(request('PUT', { first: { name: 'First member' } }, a, 'new'), params);
  assert.equal(created.status, 200);
  const first = await created.json();
  const conflictInsert = await state.PUT(request('PUT', {}, b, 'new'), params);
  assert.equal(conflictInsert.status, 409);
  const nextPayload = { ...first.payload, second: { name: 'Second member' } };
  const saved = await state.PUT(request('PUT', nextPayload, b, first.updatedAt), params);
  assert.equal(saved.status, 200);
  const second = await saved.json();
  assert(Date.parse(second.updatedAt) > Date.parse(first.updatedAt));
  assert.equal((await state.PUT(request('PUT', { first: {} }, a, first.updatedAt), params)).status, 409);
  const readAgain = await (await state.GET(request(), params)).json();
  assert.deepEqual(readAgain.payload, nextPayload);
});

test('shared API enforces role, revision, JSON validation and handles unavailable persistence', async () => {
  const { state } = routes(new Database());
  const admin = `nm_admin_auth=${await auth.createSessionToken('admin')}`;
  const member = `nm_member_auth=${await auth.createSessionToken('member')}`;
  const members = { params: Promise.resolve({ key: 'members' }) };
  for (const cookie of [undefined, 'nm_admin_auth=ok', member]) assert.equal((await state.PUT(request('PUT', {}, cookie, 'new'), members)).status, 401);
  assert.equal((await state.PUT(request('PUT', {}, admin), members)).status, 428);
  assert.equal((await state.PUT(request('PUT', {}, admin, 'bad-date'), members)).status, 400);
  for (const payload of [null, 'text', 42]) assert.equal((await state.PUT(request('PUT', payload, admin, 'new'), members)).status, 400);
  const malformed = new NextRequest('http://localhost:3000/api/site-state/members', { method: 'PUT', headers: { cookie: admin, 'If-Match': 'new', 'Content-Type': 'application/json' }, body: '{' });
  assert.equal((await state.PUT(malformed, members)).status, 400);
  for (const cookie of [undefined, member]) assert.equal((await state.GET(request('GET', undefined, cookie), { params: Promise.resolve({ key: 'table-assignment-drafts' }) })).status, 401);
  assert.equal((await state.GET(request('GET', undefined, admin), { params: Promise.resolve({ key: 'table-assignment-drafts' }) })).status, 200);
  assert.equal((await state.GET(request(), { params: Promise.resolve({ key: 'table-assignments' }) })).status, 401);
  assert.equal((await state.GET(request('GET', undefined, member), { params: Promise.resolve({ key: 'table-assignments' }) })).status, 200);
  assert.equal((await state.GET(request(), { params: Promise.resolve({ key: 'unknown' }) })).status, 404);
  assert.equal((await routes(null).state.GET(request(), members)).status, 503);
  const failed = new Database(); failed.failure = { message: 'fixture database failure' };
  assert.equal((await routes(failed).state.PUT(request('PUT', {}, admin, 'new'), members)).status, 500);
});

test('meeting saves validate inputs, round-trip fields, hide draft meetings, and reject stale updates', async () => {
  const db = new Database();
  const { meetings, meeting, login } = routes(db);
  const a = await adminCookie(login);
  const b = await adminCookie(login);
  assert.equal((await meetings.POST(request('POST', fixtureMeeting))).status, 403);
  for (const change of [{ title: '' }, { date: '2026-02-30' }, { startTime: '25:00' }, { endTime: '17:00' }, { applicationDeadline: '2026-09-21' }, { status: 'wrong' }]) {
    assert.equal((await meetings.POST(request('POST', { ...fixtureMeeting, ...change }, a))).status, 400);
  }
  const created = await meetings.POST(request('POST', fixtureMeeting, a));
  assert.equal(created.status, 200);
  const first = await created.json();
  for (const [key, value] of Object.entries(fixtureMeeting)) assert.equal(first[key], value);
  const changed = await meeting.PUT(request('PUT', { ...first, title: '会場変更後の定例会' }, b), { params: Promise.resolve({ id: first.id }) });
  assert.equal(changed.status, 200);
  const second = await changed.json();
  assert(Date.parse(second.updatedAt) > Date.parse(first.updatedAt), 'meeting revision must advance even within the same millisecond');
  assert.equal((await meeting.PUT(request('PUT', { ...first, title: 'stale' }, a), { params: Promise.resolve({ id: first.id }) })).status, 409);
  assert.equal((await meeting.PUT(request('PUT', fixtureMeeting, a), { params: Promise.resolve({ id: first.id }) })).status, 409);
  assert.equal((await meetings.POST(request('POST', { ...fixtureMeeting, id: 'draft', status: '下書き' }, a))).status, 200);
  const publicList = await (await meetings.GET(request())).json();
  assert.equal(publicList.filter((item) => ['september', 'draft'].includes(item.id)).length, 1);
  assert.equal(publicList.find((item) => item.id === 'september').title, second.title);
  assert.equal((await (await meetings.GET(request('GET', undefined, b))).json()).filter((item) => ['september', 'draft'].includes(item.id)).length, 2);
  assert.equal((await meetings.POST(request('POST', { ...fixtureMeeting, id: 'seed-meeting', status: '下書き' }, a))).status, 200);
  assert.equal((await (await meetings.GET(request())).json()).some((item) => item.id === 'seed-meeting'), false, 'stored draft must override confirmed seed before public filtering');
  assert.equal((await (await meetings.GET(request('GET', undefined, b))).json()).find((item) => item.id === 'seed-meeting').status, '下書き');
});

test('signed session rejects forged/legacy/wrong-role cookies and login prevents external redirects', async () => {
  const { login } = routes(new Database());
  const token = await auth.createSessionToken('admin');
  assert.equal(await auth.verifySessionToken(token, 'admin'), true);
  assert.equal(await auth.verifySessionToken(token, 'member'), false);
  assert.equal(await auth.verifySessionToken('ok', 'admin'), false);
  assert.equal(await auth.verifySessionToken(`X${token}`, 'admin'), false);
  const wrongPassword = await login.POST(new Request('http://localhost:3000/api/login', { method: 'POST', body: new URLSearchParams({ password: 'wrong', redirect: '/admin' }) }));
  assert.equal(wrongPassword.status, 303);
  assert.equal(wrongPassword.headers.get('set-cookie'), null);
  for (const redirect of ['https://example.com', '//example.com', '/\\example.com']) {
    const response = await login.POST(new Request('http://localhost:3000/api/login', { method: 'POST', body: new URLSearchParams({ password: process.env.MEMBER_PAGE_PASSWORD, redirect }) }));
    assert.equal(response.headers.get('location'), 'http://localhost:3000/member');
  }
});

test('attendance uses signed sessions, targeted writes preserve other responses, and guest revisions prevent overwrite', async () => {
  const db = new Database();
  const { attendance } = routes(db);
  const admin = `nm_admin_auth=${await auth.createSessionToken('admin')}`;
  const member = `nm_member_auth=${await auth.createSessionToken('member')}`;
  const params = { params: Promise.resolve({ id: 'september' }) };
  assert.equal((await attendance.GET(request(), params)).status, 401);
  assert.equal((await attendance.GET(request('GET', undefined, 'nm_admin_auth=ok'), params)).status, 401);
  assert.equal((await attendance.PUT(request('PUT', { memberId: 'a', status: '参加', expectedVersions: { a: null } }, member), params)).status, 200);
  assert.equal((await attendance.PUT(request('PUT', { memberId: 'b', status: '未定', expectedVersions: { b: null } }, member), params)).status, 200);
  const guests = [{ id: 'guest-1', name: 'Fixture guest', company: '', industry: '', type: '新規', branchName: '' }];
  assert.equal((await attendance.PUT(request('PUT', { statuses: {}, guests }, member), params)).status, 403);
  assert.equal((await attendance.PUT(request('PUT', { statuses: {}, expectedVersions: {}, guests, guestsUpdatedAt: null }, admin), params)).status, 200);
  const first = await (await attendance.GET(request('GET', undefined, admin), params)).json();
  assert.deepEqual(first.statuses, { a: '参加', b: '未定' });
  assert.equal((await attendance.PUT(request('PUT', { statuses: { a: '欠席' }, expectedVersions: { a: first.versions.a } }, admin), params)).status, 200);
  const targeted = await (await attendance.GET(request('GET', undefined, member), params)).json();
  assert.deepEqual(targeted.statuses, { a: '欠席', b: '未定' });
  assert.deepEqual(targeted.guests, guests, 'omitted guests must not erase existing guest list');
  assert.equal((await attendance.PUT(request('PUT', { statuses: {}, expectedVersions: {}, guests: [], guestsUpdatedAt: first.guestsUpdatedAt }, admin), params)).status, 200);
  assert.equal((await attendance.PUT(request('PUT', { statuses: { b: '欠席' }, expectedVersions: { b: first.versions.b }, guests, guestsUpdatedAt: first.guestsUpdatedAt }, admin), params)).status, 409);
  const afterConflict = await (await attendance.GET(request('GET', undefined, admin), params)).json();
  assert.equal(afterConflict.statuses.b, '未定', 'guest conflict must be detected before changing statuses');
  assert.deepEqual(afterConflict.guests, []);
  for (const invalid of [null, { statuses: [] }, { statuses: { a: 'wrong' } }, { statuses: {}, expectedVersions: {}, guests: [{ id: 'g', name: '' }] }]) assert.equal((await attendance.PUT(request('PUT', invalid, admin), params)).status, 400);
});

test('attendance member-vs-admin revision conflicts and legacy writes cannot overwrite current data; guest failure rolls back both tables', async () => {
  const db = new Database();
  const { attendance } = routes(db);
  const admin = `nm_admin_auth=${await auth.createSessionToken('admin')}`;
  const member = `nm_member_auth=${await auth.createSessionToken('member')}`;
  const params = { params: Promise.resolve({ id: 'meeting' }) };
  const first = await (await attendance.PUT(request('PUT', { memberId: 'a', status: '参加', expectedVersions: { a: null } }, member), params)).json();
  assert.ok(first.versions.a);
  const next = await (await attendance.PUT(request('PUT', { memberId: 'a', status: '欠席', expectedVersions: { a: first.versions.a } }, member), params)).json();
  assert.notEqual(next.versions.a, first.versions.a);
  const before = db.rows('attendance_responses');
  assert.equal((await attendance.PUT(request('PUT', { statuses: { a: '未定' }, expectedVersions: { a: first.versions.a } }, admin), params)).status, 409);
  assert.equal((await attendance.PUT(request('PUT', { statuses: { a: '未定' } }, admin), params)).status, 428);
  assert.equal((await attendance.PUT(request('PUT', { memberId: 'a', status: '参加' }, member), params)).status, 428);
  assert.equal((await attendance.PUT(request('PUT', { statuses: {}, expectedVersions: {}, guests: [], guestsUpdatedAt: 123 }, admin), params)).status, 400);
  assert.deepEqual(db.rows('attendance_responses'), before);
  db.failAttendanceAfterStatuses = true;
  assert.equal((await attendance.PUT(request('PUT', { statuses: { a: '未定' }, expectedVersions: { a: next.versions.a }, guests: [{ id: 'g', name: 'Guest' }], guestsUpdatedAt: null }, admin), params)).status, 500);
  assert.deepEqual(db.rows('attendance_responses'), before);
  assert.deepEqual(db.rows('attendance_snapshots'), []);
});
