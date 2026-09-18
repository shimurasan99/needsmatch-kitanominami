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
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('@/') ? load(`${id.slice(2)}.ts`, mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return loaded.exports;
}
const { EditableTableAssignment: Editor } = load('components/table-assignment/editable-table-assignment.tsx');
const person = id => ({ id, memberNo: id, name: id, status: '在籍', isTableLeader: false });
const initial = [
  { tableName: 'Aテーブル', seats: ['one', 'two'].map(id => ({ member: person(id), isLeader: false })) },
  { tableName: 'Bテーブル', seats: [{ guestName: '来客', guestCompany: '会社', isLeader: false }, { member: person('three'), isLeader: true }] }
];
const content = node => typeof node === 'string' ? node : (node.children ?? []).map(content).join('');
const findButton = (root, label) => root.findAllByType('button').find(node => content(node) === label);
const saveButton = renderer => renderer.root.findAllByType('button').find(node => node.props.onClick?.name === 'saveTables');
const dialog = renderer => renderer.root.findByProps({ 'aria-label': '欠席への変更を確認' });
const absentButton = (renderer, name) => renderer.root.findByProps({ 'aria-label': `${name}を欠席にする` });
function disabled(node) {
  for (let current = node; current; current = current.parent) if (current.props.disabled && (current === node || current.type === 'fieldset')) return true;
  return false;
}
async function mount(extra) {
  const values = new Map();
  global.window = { localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }, confirm: () => true };
  global.document = { activeElement: { focus() {} } };
  let renderer;
  await act(async () => { renderer = create(React.createElement(Editor, { initialTables: initial, storageKey: 'absence-draft', ...extra }), { createNodeMock: () => ({ focus() {}, showModal() {}, close() {} }) }); });
  return { renderer, values };
}
async function open(renderer, name) { await act(async () => absentButton(renderer, name).props.onClick()); }

test('absence cancellation performs no attendance write, no table change, and no implicit save', async () => {
  let calls = 0, saves = 0, saved;
  const { renderer: r } = await mount({ onMarkAbsent: async () => { calls++; return { attendanceUpdated: true }; }, onSave: async tables => { saves++; saved = tables; } });
  await open(r, 'one');
  assert.match(content(dialog(r)), /one/);
  await act(async () => findButton(dialog(r), 'キャンセル').props.onClick());
  assert.equal(calls, 0);
  assert.equal(saves, 0);
  assert.equal(findButton(r.root, '欠席にして配置から外す'), undefined);
  await act(async () => saveButton(r).props.onClick());
  assert.deepEqual(saved, initial);
  await act(async () => r.unmount());
});

test('member absence waits for attendance success, blocks concurrent changes, then removes only the target pending explicit save', async () => {
  let calls = 0, saves = 0, saved, resolve;
  const { renderer: r, values } = await mount({ onMarkAbsent: async seat => { calls++; assert.equal(seat.member.id, 'two'); return new Promise(done => { resolve = done; }); }, onSave: async tables => { saves++; saved = tables; } });
  await open(r, 'two');
  const confirm = findButton(dialog(r), '欠席にして配置から外す').props.onClick;
  let pending;
  await act(async () => { pending = confirm(); void confirm(); });
  assert.equal(calls, 1);
  assert(absentButton(r, 'two'), 'target stays visible until the server confirms');
  assert(disabled(saveButton(r)));
  const movement = r.root.findByProps({ 'aria-label': 'oneの移動先テーブル' });
  assert(disabled(movement), 'moving another seat is blocked while attendance is pending');
  assert(disabled(absentButton(r, 'one')), 'second absence cannot start concurrently');
  assert.equal(saves, 0);
  await act(async () => { resolve({ attendanceUpdated: true }); await pending; });
  assert.equal(r.root.findAllByProps({ 'aria-label': 'twoを欠席にする' }).length, 0);
  const draft = JSON.parse(values.get('absence-draft')).tables;
  assert.deepEqual(draft[0].seats.map(seat => seat.member.id), ['one']);
  assert.equal(draft[1].seats[0].guestName, '来客');
  assert.equal(draft[1].seats[1].member.id, 'three');
  assert.match(content(r.root), /出欠/);
  assert.match(content(r.root), /保存/);
  assert.equal(saves, 0, 'attendance update must not implicitly persist the table');
  await act(async () => saveButton(r).props.onClick());
  assert.deepEqual(saved[0].seats, [initial[0].seats[0]]);
  assert.deepEqual(saved[1], initial[1]);
  await act(async () => r.unmount());
});

test('failed absence keeps all seats, exposes the server error and allows retry or cancellation', async () => {
  let saved, calls = 0;
  const { renderer: r } = await mount({ onMarkAbsent: async () => { calls++; throw new Error('欠席保存失敗fixture'); }, onSave: async tables => { saved = tables; } });
  await open(r, 'one');
  await act(async () => findButton(dialog(r), '欠席にして配置から外す').props.onClick());
  assert.equal(calls, 1);
  assert(r.root.findAllByProps({ role: 'alert' }).some(node => content(node).includes('欠席保存失敗fixture')));
  assert(absentButton(r, 'one'));
  const cancel = findButton(r.root, 'キャンセル');
  if (cancel) await act(async () => cancel.props.onClick());
  await act(async () => saveButton(r).props.onClick());
  assert.deepEqual(saved, initial);
  await act(async () => r.unmount());
});

test('table-only guest absence removes the exact guest without attendance writes or implicit table save', async () => {
  let saves = 0, saved;
  const { renderer: r } = await mount({ onMarkAbsent: async seat => { assert.equal(seat.guestName, '来客'); assert.equal(seat.guestCompany, '会社'); return { attendanceUpdated: false }; }, onSave: async tables => { saves++; saved = tables; } });
  await open(r, '来客');
  await act(async () => findButton(dialog(r), '欠席にして配置から外す').props.onClick());
  assert.equal(saves, 0);
  assert.equal(r.root.findAllByProps({ 'aria-label': '来客を欠席にする' }).length, 0);
  assert.match(content(r.root), /テーブル/);
  await act(async () => saveButton(r).props.onClick());
  assert.deepEqual(saved[0], initial[0]);
  assert.deepEqual(saved[1].seats, [initial[1].seats[1]]);
  await act(async () => r.unmount());
});

test('manager delegates absence with fresh members and retains the same editor through attendance props refresh; empty seating remains explicitly savable and publishable', async () => {
  const values = new Map();
  global.window = { localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), get length() { return values.size; }, key: index => [...values.keys()][index] ?? null }, confirm: () => true, addEventListener() {}, removeEventListener() {}, setInterval() { return 1; }, clearInterval() {} };
  global.document = { visibilityState: 'visible', activeElement: { focus() {} }, addEventListener() {}, removeEventListener() {} };
  const members = [person('one')];
  const tables = [{ tableName: 'Aテーブル', seats: [{ member: members[0], isLeader: false }] }, { tableName: 'Bテーブル', seats: [] }];
  const meetings = [{ id: 'current', date: '2026-09-18', status: '確定' }];
  let calls = 0, saved, published = 0, memberReads = 0;
  const { TableAssignmentManager: Manager } = load('components/admin/table-assignment-manager.tsx', {
    '@/components/table-assignment/editable-table-assignment': { EditableTableAssignment: Editor },
    '@/lib/data/member-overrides': { fetchManagedMembers: async () => { memberReads++; return members; } },
    '@/lib/data/participant-storage': { fetchStoredParticipants: async () => ({ statuses: { one: '参加' } }), formatLocalUpdatedAt: value => value ?? '', storedParticipantsValueToParticipants: (_, __, ___, value) => [{ status: value?.statuses?.one ?? '参加', memberId: 'one' }], subscribeStoredParticipants: () => () => {} },
    '@/lib/data/meeting-storage': { fetchMeetings: async () => meetings },
    '@/lib/data/table-assignment-publication': { fetchSavedTableAssignments: async () => ({ current: { tables, updatedAt: '2026-09-18T00:00:00Z' } }), fetchPublishedTableAssignments: async () => ({}), saveTableAssignment: async (_, value) => { saved = value.tables; }, publishTableAssignment: async () => { published++; return { publishedAt: '2026-09-18T01:00:00Z' }; } },
    '@/lib/table-assignment/manual-absence': { markSeatAbsent: async (meetingId, seat, freshMembers) => { calls++; assert.equal(meetingId, 'current'); assert.equal(seat.member.id, 'one'); assert.equal(freshMembers, members); return { attendanceUpdated: true, participants: { statuses: { one: '欠席' } } }; } }
  });
  let r;
  await act(async () => { r = create(React.createElement(Manager, { meetingId: 'current', initialMembers: members, initialParticipants: [], initialMeetings: meetings, initialSeatsPerTable: 4 }), { createNodeMock: () => ({ focus() {}, showModal() {}, close() {} }) }); });
  const originalEditor = r.root.findByType(Editor);
  const readsBefore = memberReads;
  await open(r, 'one');
  await act(async () => findButton(dialog(r), '欠席にして配置から外す').props.onClick());
  assert.equal(calls, 1);
  assert(memberReads > readsBefore, 'manager retrieves latest members before writing absence');
  assert.equal(r.root.findByType(Editor), originalEditor, 'attendance refresh must not remount the editor');
  assert.equal(r.root.findAllByProps({ 'aria-label': 'oneを欠席にする' }).length, 0);
  assert.equal(saved, undefined);
  await act(async () => saveButton(r).props.onClick());
  assert.deepEqual(saved, [{ tableName: 'Aテーブル', seats: [] }, { tableName: 'Bテーブル', seats: [] }]);
  const publish = findButton(r.root, '保存済みの内容を公開する');
  assert(publish);
  assert.equal(publish.props.disabled, false);
  await act(async () => publish.props.onClick());
  assert.equal(published, 1);
  await act(async () => r.unmount());
});
