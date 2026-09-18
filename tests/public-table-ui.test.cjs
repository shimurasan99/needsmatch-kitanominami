const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function load(relative, mocks = {}) {
  const filename = path.join(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id === 'next/link' ? { __esModule: true, default: props => React.createElement('a', props) } : id === 'next/image' ? { __esModule: true, default: props => React.createElement('img', props) } : id.startsWith('@/') ? load(`${id.slice(2)}.${id.includes('/components/') ? 'tsx' : 'ts'}`, mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return loaded.exports;
}
const text = renderer => JSON.stringify(renderer.toJSON());
const content = node => typeof node === 'string' ? node : (node.children ?? []).map(content).join('');
const meeting = { id: 'next /定例会', title: '次回の会', date: '2099-01-02', startTime: '16:00', endTime: '18:00', venueName: '会場', status: '確定' };
function browser() {
  const events = new Map();
  let interval;
  global.window = { addEventListener: (event, fn) => events.set(event, fn), removeEventListener: event => events.delete(event), setInterval: (fn, ms) => { assert.equal(ms, 30000); interval = fn; return 1; }, clearInterval() {} };
  global.document = { visibilityState: 'visible', addEventListener: (event, fn) => events.set(event, fn), removeEventListener: event => events.delete(event) };
  return { tick: () => interval?.(), focus: () => events.get('focus')?.(), visible: () => events.get('visibilitychange')?.() };
}

test('next meeting card places table link immediately after application and uses the actual next confirmed meeting id', async () => {
  const { NextMeetingCard } = load('components/home/next-meeting-card.tsx', { '@/lib/data/meeting-storage': { fetchMeetings: async () => [{ ...meeting, id: 'draft', date: '2099-01-01', status: '下書き' }, meeting, { ...meeting, id: 'later', date: '2099-03-01' }] } });
  let r;
  await act(async () => { r = create(React.createElement(NextMeetingCard, { initialMeetings: [] })); });
  const links = r.root.findAllByType('a');
  const entry = links.findIndex(link => content(link) === '参加申込へ進む');
  assert(entry >= 0);
  assert.equal(content(links[entry + 1]), 'テーブル割を見る');
  assert.equal(links[entry + 1].props.href, `/table-assignments/${encodeURIComponent(meeting.id)}`);
  await act(async () => r.unmount());
});

test('public seating shows loading, unpublished and published states; focus, visibility and 30 second refresh fetch latest data without login', async () => {
  const state = browser();
  const oldFetch = global.fetch;
  let resolveFirst;
  let calls = 0;
  let payload = { meeting, publication: null };
  global.fetch = async (url, options) => {
    calls++;
    assert.equal(url, `/api/meetings/${encodeURIComponent(meeting.id)}/public-table-assignment`);
    assert.equal(options.cache, 'no-store');
    if (calls === 1) return new Promise(resolve => { resolveFirst = resolve; });
    return { ok: true, status: 200, json: async () => payload };
  };
  let r;
  try {
    const { PublicTableAssignment } = load('components/table-assignment/public-table-assignment.tsx');
    await act(async () => { r = create(React.createElement(PublicTableAssignment, { meetingId: meeting.id })); });
    assert.match(text(r), /読み込/);
    await act(async () => resolveFirst({ ok: true, status: 200, json: async () => payload }));
    assert.match(text(r), /公開/);
    assert.doesNotMatch(text(r), /ログインしてください/);
    payload = { meeting, publication: { publishedAt: '2026-09-18T00:00:00Z', tables: [{ tableName: 'Aテーブル', seats: [{ name: '公開会員', description: '公開業種', isLeader: true }] }, { tableName: 'Bテーブル', seats: [] }] } };
    await act(async () => state.focus());
    assert.match(text(r), /公開会員/);
    assert.match(text(r), /公開業種/);
    assert.match(text(r), /Aテーブル/);
    assert.match(text(r), /Bテーブル/);
    assert.match(text(r), /現在、配置されている方はいません/);
    assert.match(text(r), /リーダー/);
    payload = { ...payload, publication: { ...payload.publication, tables: [{ tableName: 'Aテーブル', seats: [{ name: '別端末で更新', description: '', isLeader: false }] }] } };
    await act(async () => state.tick());
    assert.match(text(r), /別端末で更新/);
    assert.doesNotMatch(text(r), /公開会員/);
    payload = { meeting, publication: null };
    await act(async () => state.visible());
    assert.doesNotMatch(text(r), /別端末で更新/);
    assert.equal(calls, 4);
  } finally { if (r) await act(async () => r.unmount()); global.fetch = oldFetch; }
});

test('public fetch errors hide stale published names, show alerts and allow explicit retry', async () => {
  const state = browser();
  const oldFetch = global.fetch;
  let status = 200;
  const payload = { meeting, publication: { publishedAt: '2026-09-18T00:00:00Z', tables: [{ tableName: 'Aテーブル', seats: [{ name: '古い公開氏名', description: '', isLeader: false }] }] } };
  global.fetch = async () => ({ ok: status === 200, status, json: async () => payload });
  let r;
  try {
    const { PublicTableAssignment } = load('components/table-assignment/public-table-assignment.tsx');
    await act(async () => { r = create(React.createElement(PublicTableAssignment, { meetingId: meeting.id })); });
    assert.match(text(r), /古い公開氏名/);
    status = 500;
    await act(async () => state.tick());
    assert.equal(r.root.findAllByProps({ role: 'alert' }).length, 1);
    assert.doesNotMatch(text(r), /古い公開氏名/);
    status = 404;
    await act(async () => r.root.findByType('button').props.onClick());
    assert.match(text(r), /閲覧できません/);
    status = 200;
    await act(async () => r.root.findByType('button').props.onClick());
    assert.equal(r.root.findAllByProps({ role: 'alert' }).length, 0);
    assert.match(text(r), /古い公開氏名/);
  } finally { if (r) await act(async () => r.unmount()); global.fetch = oldFetch; }
});

test('public refresh suppresses concurrent reads and hidden polling; changing meetings ignores old pending responses', async () => {
  const state = browser();
  const oldFetch = global.fetch;
  const pending = [];
  global.fetch = (url) => new Promise(resolve => pending.push({ url, resolve }));
  const response = title => ({ ok: true, status: 200, json: async () => ({ meeting: { ...meeting, title }, publication: null }) });
  let r;
  try {
    const { PublicTableAssignment } = load('components/table-assignment/public-table-assignment.tsx');
    await act(async () => { r = create(React.createElement(PublicTableAssignment, { meetingId: 'old' })); });
    await act(async () => { state.focus(); state.tick(); state.visible(); });
    assert.equal(pending.length, 1);
    await act(async () => r.update(React.createElement(PublicTableAssignment, { meetingId: 'new' })));
    assert.equal(pending.length, 2);
    assert.match(pending[1].url, /\/new\//);
    await act(async () => pending[1].resolve(response('新しい定例会')));
    await act(async () => pending[0].resolve(response('古い定例会')));
    assert.match(text(r), /新しい定例会/);
    assert.doesNotMatch(text(r), /古い定例会/);
    document.visibilityState = 'hidden';
    await act(async () => { state.tick(); state.focus(); state.visible(); });
    assert.equal(pending.length, 2);
  } finally { if (r) await act(async () => r.unmount()); global.fetch = oldFetch; }
});
