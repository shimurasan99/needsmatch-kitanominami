const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function load(relative) {
  const filename = path.join(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.paths = module.paths;
  loaded.require = id => id.startsWith('@/') ? load(`${id.slice(2)}.ts`) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return loaded.exports;
}
const initial = [
  { tableName: 'Aテーブル', seats: ['one', 'two'].map(id => ({ member: { id, memberNo: id, name: id }, isLeader: false })) },
  { tableName: 'Bテーブル', seats: [{ guestName: '既存ゲスト', guestCompany: '既存会社', isLeader: false }] }
];
const button = (r, name) => r.root.findAllByType('button').find(node => node.props.onClick?.name === name);
const panel = r => r.root.findByProps({ 'aria-label': 'ゲストとテーブルを手動で追加' });
const content = node => typeof node === 'string' ? node : (node.children ?? []).map(content).join('');
function field(r, label, type) {
  const match = panel(r).findAllByType('label').find(node => content(node).includes(label));
  assert(match, `Missing label ${label}`);
  return match.findByType(type);
}
async function guest(r, name, company, table = 'Aテーブル') {
  await act(async () => {
    field(r, 'ゲストの氏名', 'input').props.onChange({ target: { value: name } });
    field(r, 'ゲストの会社名（任意）', 'input').props.onChange({ target: { value: company } });
    field(r, 'ゲストの追加先テーブル', 'select').props.onChange({ target: { value: table } });
  });
}
const readDraft = values => JSON.parse(values.get('guest-table-draft')).tables;
const identities = tables => tables.map(table => ({ table: table.tableName, seats: table.seats.map(seat => seat.member?.id ?? `${seat.guestName}/${seat.guestCompany ?? ''}`) }));
function setup() {
  const values = new Map();
  global.window = { localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }, confirm: () => true };
  return values;
}
async function mount(props = {}) {
  const { EditableTableAssignment: Editor } = load('components/table-assignment/editable-table-assignment.tsx');
  let renderer;
  const allProps = { initialTables: initial, storageKey: 'guest-table-draft', ...props };
  await act(async () => { renderer = create(React.createElement(Editor, allProps)); });
  return { renderer, Editor, props: allProps };
}
async function click(r, name) { assert(button(r, name), `Missing handler ${name}`); await act(async () => button(r, name).props.onClick()); }
function moveSelect(r, table, index) {
  return r.root.findAllByType('article').find(article => content(article.findByType('h2')) === table).findAllByType('select')[index];
}

test('empty assignment can add one table despite a double click, save it empty, and restore it after remount', async () => {
  const values = setup();
  let saved;
  const { renderer: r, Editor, props } = await mount({ initialTables: [], onSave: async tables => { saved = tables; } });
  assert.equal(button(r, 'saveTables').props.disabled, true);
  const add = button(r, 'addTable').props.onClick;
  await act(async () => { add(); add(); });
  assert.deepEqual(readDraft(values), [{ tableName: 'Aテーブル', seats: [] }]);
  assert.equal(field(r, 'ゲストの追加先テーブル', 'select').props.value, 'Aテーブル');
  assert.equal(button(r, 'saveTables').props.disabled, false);
  await click(r, 'saveTables');
  assert.deepEqual(saved, [{ tableName: 'Aテーブル', seats: [] }]);
  assert.equal(button(r, 'undoRecentTable'), undefined);
  await act(async () => r.unmount());
  let restored;
  await act(async () => { restored = create(React.createElement(Editor, props)); });
  await click(restored, 'saveTables');
  assert.deepEqual(saved, [{ tableName: 'Aテーブル', seats: [] }]);
  await act(async () => restored.unmount());
});

test('guest append trims input, preserves prior seating/order and attendance, guards double click, and survives prop refresh', async () => {
  const values = setup();
  const attendance = Object.freeze({ one: '参加', two: '欠席' });
  const { renderer: r, Editor, props } = await mount({ seatsPerTable: 2, participantStatuses: attendance });
  await guest(r, '  新規ゲスト  ', '  新規会社  ');
  assert.match(content(panel(r)), /追加すると3名になり、設定の2名を超えます/);
  const add = button(r, 'addGuest').props.onClick;
  await act(async () => { add(); add(); });
  assert.deepEqual(identities(readDraft(values)), [
    { table: 'Aテーブル', seats: ['one', 'two', '新規ゲスト/新規会社'] }, { table: 'Bテーブル', seats: ['既存ゲスト/既存会社'] }
  ]);
  assert.equal(readDraft(values)[0].seats[2].isLeader, false);
  await act(async () => r.update(React.createElement(Editor, { ...props, initialTables: structuredClone(initial), members: [{ id: 'new', name: '追加会員' }] })));
  assert.equal(readDraft(values)[0].seats.length, 3);
  assert.deepEqual(attendance, { one: '参加', two: '欠席' });
  await act(async () => r.unmount());
});

test('blank name, unknown destination, and existing guest duplicate cannot modify seating; optional company is supported', async () => {
  const values = setup();
  const { renderer: r } = await mount();
  for (const args of [['  ', '', 'Aテーブル'], ['新規', '', '不存在'], ['  既存ゲスト ', ' 既存会社 ', 'Aテーブル']]) {
    const before = values.get('guest-table-draft');
    await guest(r, ...args);
    await click(r, 'addGuest');
    assert.equal(values.get('guest-table-draft'), before);
  }
  await guest(r, '会社未入力ゲスト', '');
  await click(r, 'addGuest');
  assert.equal(readDraft(values)[0].seats.at(-1).guestName, '会社未入力ゲスト');
  assert.equal(readDraft(values)[0].seats.at(-1).guestCompany ?? '', '');
  await act(async () => r.unmount());
});

test('new table supports manual moves; guest undo follows the guest and table undo only removes an empty table', async () => {
  const values = setup();
  const { renderer: r } = await mount();
  await click(r, 'addTable');
  assert.equal(readDraft(values).at(-1).tableName, 'Cテーブル');
  await guest(r, '移動ゲスト', '会社', 'Cテーブル');
  await click(r, 'addGuest');
  const tableUndo = button(r, 'undoRecentTable');
  if (tableUndo) {
    await act(async () => tableUndo.props.onClick());
    assert.equal(readDraft(values).at(-1).seats.length, 1, 'a nonempty new table must not be deleted');
  }
  await act(async () => moveSelect(r, 'Cテーブル', 0).props.onChange({ target: { value: 'Aテーブル' } }));
  await act(async () => moveSelect(r, 'Aテーブル', 0).props.onChange({ target: { value: 'Bテーブル' } }));
  await click(r, 'undoRecentGuest');
  assert.deepEqual(identities(readDraft(values)), [
    { table: 'Aテーブル', seats: ['two'] }, { table: 'Bテーブル', seats: ['既存ゲスト/既存会社', 'one'] }, { table: 'Cテーブル', seats: [] }
  ]);
  await click(r, 'undoRecentTable');
  assert.deepEqual(readDraft(values).map(table => table.tableName), ['Aテーブル', 'Bテーブル']);
  await act(async () => r.unmount());
});

test('failed save keeps guest/table draft and undo; successful retry persists both and clears undo across remount', async () => {
  const values = setup();
  let fail = true, saved;
  const { renderer: r, Editor, props } = await mount({ onSave: async tables => { if (fail) throw new Error('保存失敗fixture'); saved = tables; } });
  await click(r, 'addTable');
  await guest(r, '保存ゲスト', '会社', 'Aテーブル');
  await click(r, 'addGuest');
  const before = identities(readDraft(values));
  await click(r, 'saveTables');
  assert.match(content(r.root), /保存失敗fixture/);
  assert.deepEqual(identities(readDraft(values)), before);
  assert(button(r, 'undoRecentGuest'));
  assert(button(r, 'undoRecentTable'));
  fail = false;
  await click(r, 'saveTables');
  assert.deepEqual(identities(saved), before);
  assert.equal(button(r, 'undoRecentGuest'), undefined);
  assert.equal(button(r, 'undoRecentTable'), undefined);
  await act(async () => r.unmount());
  let restored;
  await act(async () => { restored = create(React.createElement(Editor, props)); });
  await click(restored, 'saveTables');
  assert.deepEqual(identities(saved), before);
  await act(async () => restored.unmount());
});
