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
  loaded.require = (id) => id.startsWith('@/') ? load(`${id.slice(2)}.ts`) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return loaded.exports;
}
const { EditableTableAssignment: Editor } = load('components/table-assignment/editable-table-assignment.tsx');
const person = (id, name = id) => ({ id, memberNo: `number-${id}`, name, status: '在籍', isTableLeader: false });
const initial = [{ tableName: 'Aテーブル', seats: [person('one'), person('two')].map((member) => ({ member, isLeader: false })) }, { tableName: 'Bテーブル', seats: [{ guestName: '来客', guestCompany: '企業', isLeader: false }] }];
const newcomer = person('b8617de1-cb89-48fe-8092-b96f15955a1b', '村下テスト');
const text = (renderer) => JSON.stringify(renderer.toJSON());
const button = (renderer, name) => renderer.root.findAllByType('button').find((node) => node.props.onClick?.name === name);
const panel = (renderer) => renderer.root.findByProps({ 'aria-label': '会員を手動で追加' });
function setup() {
  const values = new Map();
  global.window = { localStorage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }, confirm: () => true };
  return values;
}
async function select(renderer, memberId) {
  await act(async () => {
    const selects = panel(renderer).findAllByType('select');
    selects[0].props.onChange({ target: { value: memberId } });
    selects[1].props.onChange({ target: { value: 'Aテーブル' } });
  });
}

test('manual UI adds a new UUID once, preserves all existing seats, warns over capacity, saves and restores without changing attendance', async () => {
  setup();
  const statuses = Object.freeze({ [newcomer.id]: '欠席', one: '参加' });
  let saved;
  const props = { initialTables: initial, storageKey: 'manual-draft', members: [newcomer], participantStatuses: statuses, seatsPerTable: 2, onRefreshMembers: async () => {}, onSave: async (tables) => { saved = tables; } };
  let renderer;
  await act(async () => { renderer = create(React.createElement(Editor, props)); });
  assert.match(text(renderer), /村下テスト/);
  await select(renderer, newcomer.id);
  assert.match(text(renderer), /設定の/);
  const add = button(renderer, 'addSelectedMember').props.onClick;
  await act(async () => { add(); add(); });
  await act(async () => button(renderer, 'saveTables').props.onClick());
  assert.equal(saved[0].seats.length, 3);
  assert.deepEqual(saved[0].seats.slice(0, 2), initial[0].seats);
  assert.deepEqual(saved[1], initial[1]);
  assert.equal(saved[0].seats[2].member.id, newcomer.id);
  assert.equal(panel(renderer).findAllByType('option').filter((node) => node.props.value === newcomer.id).length, 0);
  assert.deepEqual(statuses, { [newcomer.id]: '欠席', one: '参加' });
  await act(async () => renderer.unmount());
  await act(async () => { renderer = create(React.createElement(Editor, props)); });
  await act(async () => button(renderer, 'saveTables').props.onClick());
  assert.equal(saved[0].seats.length, 3);
  assert.equal(saved[0].seats[2].member.id, newcomer.id);
  await act(async () => renderer.unmount());
});

test('member prop refresh adds candidates without resetting edits; refresh success/failure preserve draft and lock duplicate requests', async () => {
  setup();
  let saved;
  let renderer;
  let resolveRefresh;
  let calls = 0;
  let failing = false;
  const props = { initialTables: initial, storageKey: 'refresh-draft', members: [newcomer], participantStatuses: {}, seatsPerTable: 4, onSave: async (tables) => { saved = tables; }, onRefreshMembers: async () => { calls++; if (failing) throw new Error('最新名簿を取得できません'); await new Promise((resolve) => { resolveRefresh = resolve; }); } };
  await act(async () => { renderer = create(React.createElement(Editor, props)); });
  await select(renderer, newcomer.id);
  await act(async () => button(renderer, 'addSelectedMember').props.onClick());
  const another = person('another-new-uuid', '追加会員');
  await act(async () => renderer.update(React.createElement(Editor, { ...props, initialTables: structuredClone(initial), members: [newcomer, another] })));
  assert.equal(panel(renderer).findAllByType('option').filter((node) => node.props.value === another.id).length, 1);
  let pending;
  await act(async () => { const refresh = button(renderer, 'refreshMembers').props.onClick; pending = refresh(); void refresh(); });
  assert.equal(calls, 1);
  assert.equal(button(renderer, 'refreshMembers').props.disabled, true);
  await act(async () => { resolveRefresh(); await pending; });
  assert.match(text(renderer), /最新の状態に更新しました/);
  failing = true;
  await act(async () => button(renderer, 'refreshMembers').props.onClick());
  assert.match(text(renderer), /最新名簿を取得できません/);
  assert.equal(button(renderer, 'refreshMembers').props.disabled, false);
  await act(async () => button(renderer, 'saveTables').props.onClick());
  assert.deepEqual(saved[0].seats.map((seat) => seat.member.id), ['one', 'two', newcomer.id]);
  assert.deepEqual(saved[1], initial[1]);
  await act(async () => renderer.unmount());
});

test('undo removes only the recent addition and keeps other manual moves; successful save ends undo availability', async () => {
  setup();
  let saved;
  let renderer;
  const props = { initialTables: initial, storageKey: 'undo-draft', members: [newcomer], participantStatuses: {}, onRefreshMembers: async () => {}, onSave: async (tables) => { saved = tables; } };
  await act(async () => { renderer = create(React.createElement(Editor, props)); });
  await select(renderer, newcomer.id);
  await act(async () => button(renderer, 'addSelectedMember').props.onClick());
  // Move an existing member while keeping the newly added member in A.
  const move = renderer.root.findAllByType('select').find((node) => node.props['aria-label']?.includes('one'));
  const moveSelect = move ?? renderer.root.findAllByType('select').filter((node) => !panel(renderer).findAllByType('select').includes(node))[0];
  await act(async () => moveSelect.props.onChange({ target: { value: 'Bテーブル' } }));
  await act(async () => button(renderer, 'undoRecentAddition').props.onClick());
  await act(async () => button(renderer, 'saveTables').props.onClick());
  assert.deepEqual(saved[0].seats.map((seat) => seat.member?.id), ['two']);
  assert.equal(saved[1].seats[0].guestName, '来客');
  assert.equal(saved[1].seats[1].member.id, 'one');
  assert.equal(button(renderer, 'undoRecentAddition'), undefined);
  await select(renderer, newcomer.id);
  await act(async () => button(renderer, 'addSelectedMember').props.onClick());
  assert(button(renderer, 'undoRecentAddition'));
  await act(async () => button(renderer, 'saveTables').props.onClick());
  assert.equal(button(renderer, 'undoRecentAddition'), undefined);
  assert.equal(saved[0].seats.at(-1).member.id, newcomer.id);
  await act(async () => renderer.unmount());
});
