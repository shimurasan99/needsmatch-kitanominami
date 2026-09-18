// Real login/attendance handlers and client storage, isolated in-memory RPC only.
// No production credentials, network requests, or production rows are used.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { saveAttendance } = require('./attendance-rpc-fixture.cjs');
process.env.AUTH_SESSION_SECRET = 'cross-device-test-only-signing-secret';
process.env.MEMBER_PAGE_PASSWORD = 'test-member';
process.env.ADMIN_SHARED_PASSWORD = 'test-admin';
function load(relative, mocks = {}) {
  const file = path.join(__dirname, '..', relative), mod = new Module(file, module);
  mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
  return mod.exports;
}
const auth = load('lib/auth.ts');
const storage = load('lib/data/participant-storage.ts');
async function harness() {
  const rows = new Map();
  const db = {
    from(table) {
      const filters = []; let single = false;
      return { select() { return this; }, eq(key, value) { filters.push(row => row[key] === value); return this; }, maybeSingle() { single = true; return this; },
        then(resolve, reject) { return Promise.resolve().then(() => { const selected = (rows.get(table) ?? []).filter(row => filters.every(fn => fn(row))); return { data: structuredClone(single ? selected[0] ?? null : selected), error: null }; }).then(resolve, reject); } };
    },
    async rpc(name, args) { assert.equal(name, 'save_attendance_atomic'); return saveAttendance(rows, args); }
  };
  const api = load('app/api/meetings/[id]/attendance/route.ts', { '@/lib/auth': auth, '@/lib/supabase/server': { createSupabaseServerClient: () => db } });
  const login = load('app/api/login/route.ts', { '@/lib/auth': auth });
  async function cookie(role, clockOffset = 0) {
    const original = Date.now;
    try {
      const now = original(); Date.now = () => now + clockOffset;
      const response = await login.POST(new Request('http://localhost/api/login', { method: 'POST', body: new URLSearchParams({ password: role === 'admin' ? 'test-admin' : 'test-member', redirect: `/${role}` }) }));
      assert.equal(response.status, 303);
      assert.match(response.headers.get('set-cookie'), /HttpOnly/i);
      return response.headers.get('set-cookie').split(';')[0];
    } finally { Date.now = original; }
  }
  async function request(cookieValue, method = 'GET', body, meeting = 'september') {
    return api[method](new Request(`http://localhost/api/meetings/${meeting}/attendance`, { method, headers: { cookie: cookieValue, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), { params: Promise.resolve({ id: meeting }) });
  }
  return { cookie, request, rows };
}
test('two independently logged-in member devices and admin share all statuses; unrelated concurrent answers and stale revisions are safe', async () => {
  const h = await harness(), pc = await h.cookie('member'), phone = await h.cookie('member', 1000), admin = await h.cookie('admin');
  assert.notEqual(pc, phone);
  let version = null;
  for (const [writer, status] of [[pc, '参加'], [phone, '欠席'], [pc, '未定']]) {
    const response = await h.request(writer, 'PUT', { memberId: 'a', status, expectedVersions: { a: version } });
    assert.equal(response.status, 200);
    version = (await response.json()).versions.a;
    for (const viewer of [pc, phone, admin]) {
      const read = await h.request(viewer);
      assert.equal(read.headers.get('cache-control'), 'no-store');
      const value = await read.json();
      assert.equal(value.statuses.a, status); assert.equal(value.versions.a, version);
    }
  }
  const answers = await Promise.all([
    h.request(pc, 'PUT', { memberId: 'b', status: '参加', expectedVersions: { b: null } }),
    h.request(phone, 'PUT', { memberId: 'c', status: '欠席', expectedVersions: { c: null } })
  ]);
  assert.deepEqual(answers.map(response => response.status), [200, 200]);
  assert.deepEqual((await (await h.request(admin)).json()).statuses, { a: '未定', b: '参加', c: '欠席' });
  assert.equal((await h.request(phone, 'PUT', { memberId: 'a', status: '参加', expectedVersions: { a: null } })).status, 409);
  assert.equal((await (await h.request(pc)).json()).statuses.a, '未定');
  assert.deepEqual((await (await h.request(admin, 'GET', undefined, 'october')).json()).statuses, {});
});
test('expired member session is rejected by GET and PUT without touching stored answers', async () => {
  const h = await harness(), expired = await h.cookie('member', -(auth.SESSION_MAX_AGE + 1) * 1000);
  assert.equal((await h.request(expired)).status, 401);
  assert.equal((await h.request(expired, 'PUT', { memberId: 'a', status: '参加', expectedVersions: { a: null } })).status, 401);
  assert.equal(h.rows.size, 0);
});
test('storage-denied browser still saves remotely; committed PUT plus failed readback recovers by fresh GET', async () => {
  const h = await harness(), cookie = await h.cookie('member');
  const originalFetch = global.fetch, originalWindow = global.window;
  let failRead = false, events = 0;
  global.window = { localStorage: { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceededError'); } }, dispatchEvent() { events++; } };
  global.fetch = async (_url, options = {}) => {
    if (!options.method && failRead) throw new Error('Network interrupted');
    if (!options.method) assert.equal(options.cache, 'no-store');
    return h.request(cookie, options.method ?? 'GET', options.body ? JSON.parse(options.body) : undefined);
  };
  try {
    assert.equal(storage.readStoredParticipants('september'), null);
    const first = await storage.saveMemberAttendance('september', 'a', '参加', null);
    assert.equal(first.statuses.a, '参加'); assert.equal(events, 1);
    failRead = true;
    await assert.rejects(storage.saveMemberAttendance('september', 'a', '欠席', first.versions.a));
    assert.equal(events, 1, 'must not emit success when readback fails');
    assert.equal((await (await h.request(cookie)).json()).statuses.a, '欠席', 'PUT committed despite readback outage');
    failRead = false;
    const recovered = await storage.fetchStoredParticipants('september');
    assert.equal(recovered.statuses.a, '欠席');
    assert.notEqual(recovered.versions.a, first.versions.a);
    const next = await storage.saveMemberAttendance('september', 'a', '未定', recovered.versions.a);
    assert.equal(next.statuses.a, '未定');
  } finally { global.fetch = originalFetch; global.window = originalWindow; }
});
