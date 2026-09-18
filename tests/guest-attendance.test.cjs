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
  const filename = path.join(__dirname, '..', relative), loaded = new Module(filename, module);
  loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id === 'next/link' ? { __esModule: true, default: props => React.createElement('a', props) } : id === '@/lib/data/csv-export' ? load('lib/data/csv-export.ts') : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return loaded.exports;
}
const guest = { id: 'g', name: 'Guest', company: 'Co', industry: '', type: '新規', branchName: '' };
test('legacy guests attend by default and absent guests remain recorded but do not attend', () => {
  const { storedParticipantsValueToParticipants } = load('lib/data/participant-storage.ts');
  const value = { guests: [guest, { ...guest, id: 'g2', status: '欠席' }, { ...guest, id: 'g3', status: '参加' }] };
  assert.deepEqual(storedParticipantsValueToParticipants('m', [], [], value).map(p => p.status), ['ゲスト', '欠席', 'ゲスト']);
  assert.equal(value.guests[1].status, '欠席');
});
test('guest status API accepts only omitted, attending, or absent without changing payload', async () => {
  let sent;
  const { PUT } = load('app/api/meetings/[id]/attendance/route.ts', {
    '@/lib/auth': { isSignedInRequest: async () => true, isAdminRequest: async () => true },
    '@/lib/supabase/server': { createSupabaseServerClient: () => ({ rpc: async (_name, value) => { sent = value; return { data: { guests: value.p_guests } }; } }) }
  });
  for (const status of [undefined, '参加', '欠席', null, '未定', 'キャンセル', 1]) {
    sent = undefined;
    const item = { ...guest, ...(status === undefined ? {} : { status }) };
    const response = await PUT(new Request('http://localhost', { method: 'PUT', body: JSON.stringify({ statuses: {}, expectedVersions: {}, guests: [item], guestsUpdatedAt: null }) }), { params: Promise.resolve({ id: 'm' }) });
    const valid = status === undefined || status === '参加' || status === '欠席';
    assert.equal(response.status, valid ? 200 : 400);
    if (valid) assert.deepEqual(sent.p_guests, [item]); else assert.equal(sent, undefined);
  }
});
test('guest UI toggles attendance, preserves record, uses guest revision and exports absence', async () => {
  global.window = { addEventListener() {}, removeEventListener() {}, setInterval: () => 1, clearInterval() {} };
  global.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {}, createElement: () => ({ click() {} }) };
  let csvBlob, sent;
  window.URL = { createObjectURL: blob => { csvBlob = blob; return 'blob:test'; }, revokeObjectURL() {} };
  const { ParticipantManager } = load('components/admin/participant-manager.tsx', {
    '@/lib/data/member-overrides': { fetchManagedMembers: async () => [] },
    '@/lib/data/member-sort': { sortMembersForDirectory: value => value },
    '@/lib/data/participant-storage': { fetchStoredParticipants: async () => ({ statuses: {}, guests: [guest], guestsUpdatedAt: 'revision' }), formatLocalUpdatedAt: () => '', saveAllParticipants: async (_id, value) => { sent = value; return value; } }
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(ParticipantManager, { meetingId: 'm', initialMembers: [], initialParticipants: [] })); });
  const button = name => renderer.root.findAllByType('button').find(b => b.props.onClick?.name === name);
  await act(async () => renderer.root.findAllByType('button').find(b => React.Children.toArray(b.props.children).some(child => typeof child === 'string' && child.includes('参加者一覧'))).props.onClick());
  const select = () => renderer.root.findAllByType('select').find(s => s.props['aria-label'] === 'Guestの出欠');
  assert.equal(select().props.value, '参加');
  const statistic = label => renderer.root.findAll(node => node.type?.name === 'Stat').find(node => node.props.label === label).props.value;
  assert.equal(statistic('参加'), '1名');
  await act(async () => select().props.onChange({ target: { value: '欠席' } }));
  assert.equal(statistic('参加'), '0名');
  assert.equal(statistic('欠席'), '1名');
  assert.equal(statistic('参加ゲスト'), '0名');
  assert.match(JSON.stringify(renderer.toJSON()), /欠席ゲスト/);
  await act(async () => button('exportCsv').props.onClick());
  assert.match(await csvBlob.text(), /"Guest","Co","","欠席"/);
  await act(async () => button('saveParticipants').props.onClick());
  assert.equal(sent.guestsUpdatedAt, 'revision');
  assert.deepEqual(sent.statuses, {});
  assert.deepEqual(sent.guests, [{ ...guest, status: '欠席' }]);
  assert.equal(select().props.value, '欠席');
  await act(async () => select().props.onChange({ target: { value: '参加' } }));
  assert.equal(statistic('参加'), '1名');
  assert.equal(statistic('欠席'), '0名');
  await act(async () => renderer.unmount());
});
