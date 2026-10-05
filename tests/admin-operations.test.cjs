const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const crypto = require('node:crypto');
function load(file, mocks = {}) {
  const filename = path.join(__dirname, '..', file), m = new Module(filename, module);
  m.paths = module.paths;
  m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  return m.exports;
}
const operations = load('lib/admin/operations.ts');
const forms = load('lib/admin/form-response.ts', { '@/lib/admin/operations': operations });
const scripts = load('lib/admin/google-form-script.ts', { '@/lib/admin/form-response': forms });
function form() {
  const values = Array(25).fill('');
  values[0] = '2026/10/05 12:00:00'; values[2] = '2026/10/16（金）'; values[4] = 'NM-1234'; values[23] = 'テスト 太郎';
  return { spreadsheetId: forms.FORM_SHEET_ID, sheetId: forms.FORM_TAB_ID, row: 2, values };
}
test('source name and number collisions never join by number alone', () => {
  const members = [{ id: 'a', name: '佐藤 正人', memberNo: '9147' }, { id: 'b', name: '中本 怜男', memberNo: '9147' }];
  assert.equal(operations.matchMember(members, '9147', '中本　怜男').id, 'b');
  assert.equal(operations.matchMember(members, '9147', '別人'), undefined);
  assert.equal(operations.matchMember([...members, { id: 'c', name: '中本怜男', memberNo: '99' }], '', '中本怜男'), undefined);
});
test('training blanks remain unknown; invalid date and duplicate member bindings are rejected', () => {
  const data = operations.emptyOperations();
  data.training.push({ id: 't', memberId: 'm', memberNo: '1', name: 'テスト', courses: operations.emptyCourses(), sourceAsOf: '2025.11末', note: '' });
  assert.equal(operations.validateOperations(data).training[0].courses['商談'].status, '未確認');
  data.training[0].courses['商談'].date = '2026-02-30';
  assert.throws(() => operations.validateOperations(data));
  data.training[0].courses['商談'].date = '2026-02-28';
  data.training.push({ ...data.training[0], id: 't2' });
  assert.throws(() => operations.validateOperations(data), /重複/);
  assert.equal(operations.safeHttpUrl('javascript:alert(1)'), '');
});
test('modern and legacy form columns parse without mistaking numbers for names', () => {
  const modern = form();
  assert.equal(forms.parseFormResponse(modern).meetingDate, '2026-10-16');
  assert.equal(forms.parseFormResponse(modern).memberNo, '1234');
  const legacy = form(); legacy.values[3] = '4076'; legacy.values[4] = 'テスト 花子'; legacy.values[23] = '';
  assert.equal(forms.parseFormResponse(legacy).name, 'テスト 花子');
  assert.equal(forms.parseFormResponse(legacy).memberNo, '4076');
  legacy.values[2] = '';
  assert.equal(forms.parseFormResponse(legacy).meetingDate, '');
  assert.match(forms.parseFormResponse(legacy).note, /開催日要確認/);
  assert.throws(() => forms.parseFormResponse({ ...legacy, sheetId: 1 }));
  modern.values[23] = ''; assert.equal(forms.parseFormResponse(modern).name, '');
  assert.match(forms.parseFormResponse(modern).note, /氏名を特定できない/);
});
function database() {
  const rows = new Map();
  return { rows, from() {
    let key, version, inserted, updated;
    const q = {
      select() { return q; }, eq(column, value) { if (column === 'state_key') key = value; else version = value; return q; },
      insert(row) { inserted = row; return q; }, update(row) { updated = row; return q; }, maybeSingle() { return q; },
      then(resolve, reject) { return Promise.resolve().then(() => {
        if (inserted) { if (rows.has(inserted.state_key)) return { data: null, error: { code: '23505' } }; rows.set(inserted.state_key, structuredClone(inserted)); return { data: inserted, error: null }; }
        const existing = rows.get(key);
        if (updated) { if (!existing || existing.updated_at !== version) return { data: null, error: null }; rows.set(key, structuredClone(updated)); return { data: updated, error: null }; }
        return { data: existing || null, error: null };
      }).then(resolve, reject); }
    }; return q;
  } };
}
function request(method, body, headers = {}) { return new Request('http://localhost/api/test', { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
test('private operations deny non-admins and prevent stale writes across devices', async () => {
  const db = database();
  const route = load('app/api/admin/operations/route.ts', { '@/lib/admin/operations': operations, '@/lib/auth': { isAdminRequest: async r => r.headers.get('x-test-role') === 'admin' }, '@/lib/supabase/server': { createSupabaseServerClient: () => db } });
  for (const role of ['', 'member']) {
    assert.equal((await route.GET(request('GET', undefined, { 'x-test-role': role }))).status, 401);
    assert.equal((await route.PUT(request('PUT', operations.emptyOperations(), { 'x-test-role': role, 'if-match': 'new' }))).status, 401);
  }
  const headers = { 'x-test-role': 'admin', 'if-match': 'new' };
  const created = await route.PUT(request('PUT', operations.emptyOperations(), headers));
  assert.equal(created.status, 200); const first = await created.json();
  assert.equal((await route.PUT(request('PUT', operations.emptyOperations(), headers))).status, 409);
  const next = { ...first.data, sourceNote: '別端末で更新' };
  assert.equal((await route.PUT(request('PUT', next, { ...headers, 'if-match': first.version }))).status, 200);
  assert.equal((await route.PUT(request('PUT', first.data, { ...headers, 'if-match': first.version }))).status, 409);
  const reread = await route.GET(request('GET', undefined, headers));
  assert.equal(reread.headers.get('cache-control'), 'no-store');
  assert.equal((await reread.json()).data.sourceNote, '別端末で更新');
});
test('webhook requires secret; retries and moved source rows cannot overwrite HP review state', async () => {
  const db = database(), secret = 'test-only-form-token-12345678901234567890';
  db.rows.set('admin-google-forms-secret', { payload: { hash: crypto.createHash('sha256').update(secret).digest('hex') } });
  const route = load('app/api/integrations/google-forms/route.ts', { '@/lib/admin/form-response': forms, '@/lib/supabase/server': { createSupabaseServerClient: () => db } });
  assert.equal((await route.POST(request('POST', form()))).status, 401);
  const headers = { authorization: `Bearer ${secret}` };
  assert.equal((await route.POST(request('POST', form(), headers))).status, 200);
  const key = [...db.rows.keys()].find(k => k.startsWith('admin-form:'));
  db.rows.get(key).payload.applied = { meetingId: 'october', memberId: 'm1' };
  const replay = await route.POST(request('POST', { ...form(), row: 200 }, headers));
  assert.equal((await replay.json()).duplicate, true);
  assert.equal(db.rows.size, 2);
  assert.equal(db.rows.get(key).payload.applied.memberId, 'm1');
  assert.equal((await route.POST(request('POST', { ...form(), sheetId: 999 }, headers))).status, 400);
});
test('Apps Script checks columns on live and historical paths and advances only after success', () => {
  const script = scripts.googleFormScript('test-secret');
  assert.equal((script.match(/checkNeedsMatchHeaders\(sheet\);/g) || []).length, 2);
  assert.match(script, /onFormSubmit\(\)/);
  assert.match(script, /everyMinutes\(5\)/);
  assert.doesNotMatch(script, /\.setValues?\(/);
  assert.ok(script.indexOf('sendNeedsMatchRow(row, values[i])') < script.indexOf('props.setProperty("NM_NEXT_ROW", String(row + 1))'));
});
