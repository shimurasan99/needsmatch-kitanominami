const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { NextRequest } = require('next/server');

function load(file, mocks) {
  const filename = path.join(__dirname, '..', file);
  const loaded = new Module(filename, module);
  loaded.paths = module.paths;
  loaded.require = (id) => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  return loaded.exports;
}

function request(body, admin = true) {
  return new NextRequest('http://localhost/api/meetings/current/table-assignment-publication', { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-admin': String(admin) }, body: JSON.stringify(body) });
}
const version = '2026-09-15T00:00:00.000Z';
const valid = { expectedSavedRevision: version, expectedPublishedRevision: null };
const params = { params: Promise.resolve({ id: 'current' }) };
const auth = { isAdminRequest: async (request) => request.headers.get('x-test-admin') === 'true' };

test('publication API authorizes and delegates both revisions once to the atomic database RPC without client tables', async () => {
  const calls = [];
  const publication = { meetingId: 'current', tables: [{ tableName: 'DB saved', seats: [] }], publishedAt: version };
  const route = load('app/api/meetings/[id]/table-assignment-publication/route.ts', {
    '@/lib/auth': auth,
    '@/lib/supabase/server': { createSupabaseServerClient: () => ({ rpc: async (name, args) => { calls.push({ name, args }); return { data: { publication }, error: null }; } }) }
  });
  assert.equal((await route.POST(request(valid, false), params)).status, 401);
  for (const invalid of [{}, { ...valid, expectedSavedRevision: null }, { ...valid, expectedPublishedRevision: 'invalid' }]) assert.equal((await route.POST(request(invalid), params)).status, 400);
  assert.equal(calls.length, 0);
  const response = await route.POST(request({ ...valid, tables: ['malicious stale replacement'] }), params);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).publication, publication);
  assert.deepEqual(calls, [{ name: 'publish_table_assignment', args: { p_meeting_id: 'current', p_expected_draft_revision: version, p_expected_publication_revision: null } }]);
});

test('publication conflicts and missing SQL fail closed without non-atomic fallback/retry', async () => {
  for (const [error, status] of [[{ code: 'P0001', message: 'NM_TABLE_CONFLICT' }, 409], [{ code: 'PGRST202' }, 503], [{ code: '42883' }, 503], [{ code: '22023' }, 400], [{ code: 'XX000' }, 500]]) {
    let calls = 0;
    const route = load('app/api/meetings/[id]/table-assignment-publication/route.ts', {
      '@/lib/auth': auth, '@/lib/supabase/server': { createSupabaseServerClient: () => ({ rpc: async () => { calls++; return { data: null, error }; } }) }
    });
    assert.equal((await route.POST(request(valid), params)).status, status);
    assert.equal(calls, 1);
  }
});

test('legacy aggregate publication PUT is refused even for authenticated admin', async () => {
  const route = load('app/api/site-state/[key]/route.ts', { '@/lib/auth': auth, '@/lib/supabase/server': { createSupabaseServerClient: () => { throw new Error('Old client must never reach persistence'); } } });
  const response = await route.PUT(request({ staleMeeting: {} }), { params: Promise.resolve({ key: 'table-assignments' }) });
  assert.equal(response.status, 428);
});
