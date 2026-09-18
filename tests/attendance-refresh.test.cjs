const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
function load(relative, mocks = {}) {
  const filename = path.join(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id === 'next/link' ? { __esModule: true, default: props => React.createElement('a', props) } : id === '@/lib/data/csv-export' ? load('lib/data/csv-export.ts') : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return loaded.exports;
}
function browser() {
  const events = new Map(), cache = new Map();
  let interval;
  global.window = { addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name), setInterval: (fn, delay) => { assert.equal(delay, 30000); interval = fn; return 1; }, clearInterval() {}, dispatchEvent() {}, localStorage: { getItem: key => cache.get(key), setItem: (key, value) => cache.set(key, value) } };
  global.document = { visibilityState: 'visible', addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name) };
  return { focus: () => events.get('focus')?.(), visible: () => events.get('visibilitychange')?.(), tick: () => interval?.(), cache };
}
const members = [{ id: 'a', name: 'A', memberNo: '1', industry: '', company: '' }, { id: 'b', name: 'B', memberNo: '2', industry: '', company: '' }];

test('remote revision replaces obsolete success message only when selected answer is clean', async () => {
  const state = browser();
  let remote = { statuses: { a: '未定' }, versions: { a: 'v1' } };
  let fail = false;
  const { AttendanceForm } = load('components/member/attendance-form.tsx', {
    '@/lib/data/member-sort': { sortMembersForDirectory: value => value },
    '@/lib/data/participant-storage': { fetchStoredParticipants: async () => remote, saveMemberAttendance: async () => { if (fail) throw new Error('競合エラー保持'); remote = { statuses: { a: '参加' }, versions: { a: 'v2' } }; return remote; } }
  });
  let r;
  await act(async () => { r = create(React.createElement(AttendanceForm, { meeting: { id: 'm' }, members })); });
  const radio = value => r.root.findAllByType('input').find(input => input.props.value === value);
  await act(async () => r.root.findByType('select').props.onChange({ target: { value: 'a' } }));
  await act(async () => radio('参加').props.onChange());
  await act(async () => r.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  await act(async () => state.tick());
  assert.match(JSON.stringify(r.toJSON()), /保存し、反映を確認しました/);
  assert.doesNotMatch(JSON.stringify(r.toJSON()), /別の画面から/);
  remote = { statuses: { a: '欠席' }, versions: { a: 'v3' } };
  await act(async () => state.tick());
  assert.equal(radio('欠席').props.checked, true);
  assert.match(JSON.stringify(r.toJSON()), /別の画面から更新された最新の回答/);
  assert.doesNotMatch(JSON.stringify(r.toJSON()), /保存し、反映を確認しました/);
  await act(async () => radio('未定').props.onChange());
  fail = true;
  await act(async () => r.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  remote = { statuses: { a: '参加' }, versions: { a: 'v4' } };
  await act(async () => state.tick());
  assert.equal(radio('未定').props.checked, true);
  assert.match(JSON.stringify(r.toJSON()), /競合エラー保持/);
  assert.doesNotMatch(JSON.stringify(r.toJSON()), /別の画面から/);
  await act(async () => r.unmount());
});

test('30 second refresh preserves dirty choice; explicit reload confirms discard, locks operations and keeps draft on failure', async () => {
  const state = browser();
  let remote = { statuses: { a: '未定' }, versions: { a: 'v1' } };
  let fail = false, resolveRead, held = false, reads = 0, writes = 0, sentVersion;
  const { AttendanceForm } = load('components/member/attendance-form.tsx', {
    '@/lib/data/member-sort': { sortMembersForDirectory: value => value },
    '@/lib/data/participant-storage': {
      fetchStoredParticipants: async () => { reads++; if (fail) throw new Error('通信エラー'); if (held) return new Promise(resolve => { resolveRead = resolve; }); return remote; },
      saveMemberAttendance: async (_, __, ___, version) => { writes++; sentVersion = version; throw new Error('更新が競合しました'); }
    }
  });
  let r;
  await act(async () => { r = create(React.createElement(AttendanceForm, { meeting: { id: 'm' }, members })); });
  const radio = value => r.root.findAllByType('input').find(input => input.props.value === value);
  const reload = () => r.root.findAllByType('button').find(button => button.props.type === 'button');
  await act(async () => r.root.findByType('select').props.onChange({ target: { value: 'a' } }));
  remote = { statuses: { a: '参加' }, versions: { a: 'v2' } };
  await act(async () => state.tick());
  assert.equal(radio('参加').props.checked, true);
  await act(async () => radio('欠席').props.onChange());
  remote = { statuses: { a: '未定' }, versions: { a: 'v3' } };
  await act(async () => state.tick());
  assert.equal(radio('欠席').props.checked, true);
  await act(async () => r.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  assert.equal(sentVersion, 'v2');
  assert.match(r.root.findByProps({ role: 'alert' }).children.filter(child => typeof child === 'string').join(''), /競合/);
  const confirm = () => r.root.findByProps({ role: 'alertdialog' }).findAllByType('button')[1];
  const before = reads;
  await act(async () => reload().props.onClick());
  assert.equal(r.root.findByType('select').props.disabled, true);
  assert.equal(r.root.findByType('fieldset').props.disabled, true);
  await act(async () => { state.tick(); void r.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  await act(async () => r.root.findByProps({ role: 'alertdialog' }).findAllByType('button')[0].props.onClick());
  assert.equal(reads, before);
  assert.equal(radio('欠席').props.checked, true);
  fail = true;
  await act(async () => reload().props.onClick());
  await act(async () => confirm().props.onClick());
  assert.equal(radio('欠席').props.checked, true);
  assert.match(JSON.stringify(r.toJSON()), /通信エラー/);
  fail = false; held = true;
  let pending;
  await act(async () => reload().props.onClick());
  const callback = confirm().props.onClick;
  const readsBefore = reads;
  await act(async () => { pending = callback(); void callback(); void r.root.findByType('form').props.onSubmit({ preventDefault() {} }); state.tick(); });
  assert.equal(reads, readsBefore + 1);
  assert.equal(writes, 1);
  assert.equal(reload().props.disabled, true);
  await act(async () => { resolveRead(remote); await pending; });
  assert.equal(radio('未定').props.checked, true);
  assert.equal(r.root.findAllByProps({ role: 'alert' }).length, 0);
  await act(async () => radio('参加').props.onChange());
  await act(async () => r.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  assert.equal(sentVersion, 'v3');
  await act(async () => r.unmount());
});

test('server attendance cache never overwrites or restores legacy browser answers', async () => {
  const { cache } = browser();
  const legacy = JSON.stringify({ statuses: { a: '参加' }, guests: [{ id: 'old', name: 'Legacy' }] });
  cache.set('nm_meeting_participants_m', legacy);
  const { fetchStoredParticipants } = load('lib/data/participant-storage.ts');
  const oldFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ statuses: {}, versions: {}, guests: [], guestsUpdatedAt: null }) });
  try {
    assert.deepEqual((await fetchStoredParticipants('m')).statuses, {});
    assert.equal(cache.get('nm_meeting_participants_m'), legacy);
    assert.deepEqual(JSON.parse(cache.get('nm_meeting_participants_server_v2_m')).guests, []);
  } finally { global.fetch = oldFetch; }
});

test('member save verifies persisted response and never treats an unchanged GET as success', async () => {
  const { cache } = browser();
  const { saveMemberAttendance } = load('lib/data/participant-storage.ts');
  const oldFetch = global.fetch;
  let value = { statuses: { a: '未定', b: '欠席' }, versions: { a: '2026-09-15' }, updatedAt: '2026-09-15' };
  global.fetch = async (_url, options) => ({ ok: true, json: async () => options.method === 'PUT' ? { statuses: { a: '参加' }, versions: { a: '2026-09-15' } } : value });
  try {
    await assert.rejects(saveMemberAttendance('m', 'a', '参加', null), /保存後の出欠/);
    value = { statuses: { a: '参加', b: '欠席' }, versions: { a: '2026-09-16' }, updatedAt: '2026-09-16' };
    assert.equal((await saveMemberAttendance('m', 'a', '参加', null)).updatedAt, value.updatedAt);
    assert.equal(JSON.parse(cache.get('nm_meeting_participants_server_v2_m')).statuses.b, '欠席');
  } finally { global.fetch = oldFetch; }
});

test('member form refreshes another device response on focus without discarding unsaved choice', async () => {
  const browserState = browser();
  let remote = { statuses: { a: 'キャンセル' }, versions: { a: '2026-09-01' } };
  let expectedVersion;
  const { AttendanceForm } = load('components/member/attendance-form.tsx', {
    '@/lib/data/member-sort': { sortMembersForDirectory: value => value },
    '@/lib/data/participant-storage': { fetchStoredParticipants: async () => remote, saveMemberAttendance: async (_meeting, _id, _status, version) => { expectedVersion = version; throw new Error('更新が競合しました'); } }
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(AttendanceForm, { meeting: { id: 'm' }, members })); });
  await act(async () => renderer.root.findByType('select').props.onChange({ target: { value: 'a' } }));
  const radio = value => renderer.root.findAllByType('input').find(input => input.props.value === value);
  assert.equal(radio('欠席').props.checked, true, 'cancelled must not display as attending');
  remote = { statuses: { a: '参加' }, versions: { a: '2026-09-02' } };
  await act(async () => browserState.visible());
  assert.equal(radio('参加').props.checked, true);
  await act(async () => radio('未定').props.onChange());
  remote = { statuses: { a: '欠席' }, versions: { a: '2026-09-03' } };
  await act(async () => browserState.focus());
  assert.equal(radio('未定').props.checked, true, 'local unsaved selection must survive refresh');
  assert.match(JSON.stringify(renderer.toJSON()), /現在保存されている回答/);
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  assert.equal(expectedVersion, '2026-09-02', 'refresh must not bless a dirty edit with a new revision');
  assert.equal(radio('未定').props.checked, true);
  assert.match(JSON.stringify(renderer.toJSON()), /競合/);
  await act(async () => renderer.unmount());
});

test('member save ignores stale refresh and duplicate synchronous submits; canonical cancellation remains absent', async () => {
  const state = browser();
  let reads = 0, saves = 0, resolveRead, resolveSave;
  const { AttendanceForm } = load('components/member/attendance-form.tsx', {
    '@/lib/data/member-sort': { sortMembersForDirectory: value => value },
    '@/lib/data/participant-storage': {
      fetchStoredParticipants: () => ++reads === 1 ? Promise.resolve({ statuses: { a: '未定' }, versions: { a: 'v1' } }) : new Promise(resolve => { resolveRead = resolve; }),
      saveMemberAttendance: () => { saves++; return new Promise(resolve => { resolveSave = resolve; }); }
    }
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(AttendanceForm, { meeting: { id: 'm' }, members })); });
  await act(async () => renderer.root.findByType('select').props.onChange({ target: { value: 'a' } }));
  await act(async () => renderer.root.findAllByType('input').find(input => input.props.value === '参加').props.onChange());
  await act(async () => state.focus());
  const submit = renderer.root.findByType('form').props.onSubmit;
  let first, second;
  await act(async () => { first = submit({ preventDefault() {} }); second = submit({ preventDefault() {} }); });
  assert.equal(saves, 1);
  await act(async () => { resolveRead({ statuses: { a: '欠席' }, versions: { a: 'old' } }); });
  assert.equal(renderer.root.findAllByType('input').find(input => input.props.value === '参加').props.checked, true);
  await act(async () => { resolveSave({ statuses: { a: '参加', b: 'キャンセル' }, versions: { a: 'v2', b: 'v3' } }); await first; await second; });
  await act(async () => renderer.root.findByType('select').props.onChange({ target: { value: 'b' } }));
  assert.equal(renderer.root.findAllByType('input').find(input => input.props.value === '欠席').props.checked, true);
  await act(async () => renderer.unmount());
});

test('admin save verifies changed answers and guest list after PUT; unrelated answers do not conflict', async () => {
  browser();
  const { saveAllParticipants } = load('lib/data/participant-storage.ts');
  const oldFetch = global.fetch;
  let remote = { statuses: { a: '未定', b: '参加' }, versions: { a: '2026-09-15' }, guests: [] };
  global.fetch = async (_url, options) => ({ ok: true, json: async () => options.method === 'PUT' ? { statuses: JSON.parse(options.body).statuses, versions: { a: '2026-09-15' }, guests: JSON.parse(options.body).guests ?? [] } : remote });
  try {
    await assert.rejects(saveAllParticipants('m', { statuses: { a: '欠席' } }), /送信内容と一致しません/);
    remote = { statuses: { a: '欠席', b: '参加' }, versions: { a: '2026-09-15' }, guests: [] };
    assert.equal((await saveAllParticipants('m', { statuses: { a: '欠席' } })).statuses.b, '参加');
    await assert.rejects(saveAllParticipants('m', { statuses: {}, guests: [{ id: 'g', name: 'Guest' }] }), /送信内容と一致しません/);
    remote.guests = [{ name: 'Guest', id: 'g' }];
    assert.equal((await saveAllParticipants('m', { statuses: {}, guests: [{ id: 'g', name: 'Guest' }] })).guests.length, 1, 'Postgres JSONB object key order must not cause a mismatch');
    await assert.rejects(saveAllParticipants('m', { statuses: {}, guests: [] }), /送信内容と一致しません/);
  } finally { global.fetch = oldFetch; }
});

test('admin refresh reflects another member response and preserves local edits without overwriting untouched guests', async () => {
  const browserState = browser();
  let remote = { statuses: { a: '未定', b: '未定' }, versions: { a: '2026-09-01', b: '2026-09-01' }, guests: [], guestsUpdatedAt: 'old' };
  let sent;
  const { ParticipantManager } = load('components/admin/participant-manager.tsx', {
    '@/lib/data/member-overrides': { fetchManagedMembers: async () => members },
    '@/lib/data/member-sort': { sortMembersForDirectory: value => value },
    '@/lib/data/participant-storage': { fetchStoredParticipants: async () => remote, formatLocalUpdatedAt: value => value || '', saveAllParticipants: async (_id, value) => { sent = value; throw new Error('競合しました。再読み込みしてください。'); } }
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(ParticipantManager, { meetingId: 'm', initialMembers: members, initialParticipants: [] })); });
  const selects = () => renderer.root.findAllByType('select');
  await act(async () => selects()[0].props.onChange({ target: { value: '欠席' } }));
  remote = { ...remote, statuses: { a: '参加', b: '参加' }, versions: { a: '2026-09-02', b: '2026-09-02' } };
  await act(async () => browserState.visible());
  assert.equal(selects()[0].props.value, '欠席');
  assert.equal(selects()[1].props.value, '参加');
  await act(async () => renderer.root.findAllByType('button').find(button => button.props.onClick?.name === 'saveParticipants').props.onClick());
  assert.deepEqual(sent.statuses, { a: '欠席' });
  assert.deepEqual(sent.expectedVersions, { a: '2026-09-01' });
  assert.equal(Object.hasOwn(sent, 'guests'), false);
  assert.equal(selects()[0].props.value, '欠席', 'conflict keeps the draft');
  await act(async () => browserState.focus());
  await act(async () => renderer.root.findAllByType('button').find(button => button.props.onClick?.name === 'saveParticipants').props.onClick());
  assert.deepEqual(sent.expectedVersions, { a: '2026-09-01' }, 'retry must not silently rebase over another member answer');
  await act(async () => renderer.unmount());
});
