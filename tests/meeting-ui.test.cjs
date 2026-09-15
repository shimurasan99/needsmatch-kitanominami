const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;

function load(relative, mocks) {
  const filename = path.join(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.paths = module.paths;
  loaded.require = id => id === 'next/link' ? { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) } : id === '@/lib/data/csv-export' ? load('lib/data/csv-export.ts', {}) : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return loaded.exports;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
const text = renderer => JSON.stringify(renderer.toJSON());
const fixtureMeeting = { id: 'meeting', title: 'Stale title', date: '2099-09-20', startTime: '16:00', endTime: '18:00', venueName: 'Venue', venueAddress: '', applicationDeadline: '2099-09-19', status: '確定' };
const members = [{ id: 'a', name: 'A', memberNo: '1', company: '', industry: '', position: '一般会員' }, { id: 'b', name: 'B', memberNo: '2', company: '', industry: '', position: '一般会員' }];

test('meeting list does not mount stale editable settings before the server loads', async () => {
  const pending = deferred();
  const Settings = props => React.createElement('input', { value: props.meeting.title, readOnly: true });
  const { MeetingsManagement } = load('components/admin/meetings-management.tsx', {
    '@/components/admin/meeting-settings-panel': { MeetingSettingsPanel: Settings },
    '@/components/admin/past-data-manager': { PastDataManager: () => null },
    '@/lib/data/meeting-storage': { fetchMeetings: () => pending.promise }
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(MeetingsManagement, { meetings: [fixtureMeeting], members: [], participants: [], pastAssignments: [] })); });
  assert.equal(renderer.root.findAllByType(Settings).length, 0);
  assert.equal(renderer.root.findAllByType('button').length, 0);
  await act(async () => pending.resolve([{ ...fixtureMeeting, title: 'Server title', updatedAt: '2026-09-15T00:00:00Z' }]));
  assert.equal(renderer.root.findByType(Settings).props.meeting.title, 'Server title');
  await act(async () => renderer.unmount());
});

test('new meeting locks fields and close action during save, rejects duplicate submission and retains inputs after failure', async () => {
  const pending = deferred();
  let calls = 0;
  const { MeetingsManagement } = load('components/admin/meetings-management.tsx', {
    '@/components/admin/meeting-settings-panel': { MeetingSettingsPanel: () => null },
    '@/components/admin/past-data-manager': { PastDataManager: () => null },
    '@/lib/data/meeting-storage': { fetchMeetings: async () => [], saveMeetingRecord: () => { calls++; return pending.promise; } }
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(MeetingsManagement, { meetings: [], members: [], participants: [], pastAssignments: [] })); });
  await act(async () => renderer.root.findAllByType('button').find(button => button.children.includes('月例会の新規作成')).props.onClick());
  const dateInput = () => renderer.root.findAllByType('input').find(input => input.props.type === 'date');
  await act(async () => dateInput().props.onChange({ target: { value: '2099-09-20' } }));
  let saving;
  await act(async () => { saving = renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  assert.equal(renderer.root.findByType('fieldset').props.disabled, true);
  await act(async () => renderer.root.findAllByType('button').find(button => button.props['aria-label'] === '閉じる').props.onClick());
  assert.equal(renderer.root.findAllByType('form').length, 1);
  await act(async () => dateInput().props.onChange({ target: { value: '2099-10-01' } }));
  assert.equal(dateInput().props.value, '2099-09-20');
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  assert.equal(calls, 1);
  await act(async () => { pending.reject(new Error('Save refused')); await saving; });
  assert.match(text(renderer), /Save refused/);
  assert.equal(renderer.root.findByType('fieldset').props.disabled, false);
  assert.equal(dateInput().props.value, '2099-09-20');
  await act(async () => renderer.unmount());
});

test('meeting settings disable repeated submission and expose server failure without false success', async () => {
  const pending = deferred();
  let calls = 0;
  const { MeetingSettingsPanel } = load('components/admin/meeting-settings-panel.tsx', {
    '@/lib/data/meeting-storage': { saveMeetingRecord: () => { calls++; return pending.promise; } },
    '@/lib/data/participant-storage': { fetchStoredParticipants: async () => ({}), storedParticipantsValueToParticipants: () => [], subscribeStoredParticipants: () => () => {} }
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(MeetingSettingsPanel, { meeting: fixtureMeeting, members: [], participants: [], onSaved: () => assert.fail('failed save must not notify success') })); });
  await act(async () => renderer.root.findByType('button').props.onClick());
  let saving;
  await act(async () => { saving = renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  assert.equal(renderer.root.findAllByType('button').find(button => button.props.type === 'submit').props.disabled, true);
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  assert.equal(calls, 1);
  await act(async () => { pending.reject(new Error('Server unavailable')); await saving; });
  assert.match(text(renderer), /Server unavailable/);
  assert.doesNotMatch(text(renderer), /保存しました/);
  assert.equal(renderer.root.findAllByType('button').find(button => button.props.type === 'submit').props.disabled, false);
  await act(async () => renderer.unmount());
});

test('member attendance waits for both current meetings and managed members before mounting form', async () => {
  const meetingRead = deferred();
  const memberRead = deferred();
  const Form = () => React.createElement('form');
  const { AttendancePageClient } = load('components/member/attendance-page-client.tsx', {
    '@/components/member/attendance-form': { AttendanceForm: Form },
    '@/lib/data/meeting-storage': { fetchMeetings: () => meetingRead.promise },
    '@/lib/data/member-overrides': { fetchManagedMembers: () => memberRead.promise }
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(AttendancePageClient, { initialMeetings: [fixtureMeeting], members: [] })); });
  assert.equal(renderer.root.findAllByType(Form).length, 0);
  await act(async () => meetingRead.resolve([{ ...fixtureMeeting, title: 'Updated' }]));
  assert.equal(renderer.root.findAllByType(Form).length, 0);
  await act(async () => memberRead.resolve(members));
  assert.equal(renderer.root.findByType(Form).props.members.length, 2);
  assert.equal(renderer.root.findByType(Form).props.meeting.title, 'Updated');
  await act(async () => renderer.unmount());
});

test('participant hydration is gated and saving sends only changed statuses, preserving another response', async () => {
  const memberRead = deferred();
  let memberReads = 0;
  let sent;
  const { ParticipantManager } = load('components/admin/participant-manager.tsx', {
    '@/lib/data/member-overrides': { fetchManagedMembers: () => { memberReads++; return memberRead.promise; } },
    '@/lib/data/member-sort': { sortMembersForDirectory: value => value },
    '@/lib/data/participant-storage': {
      fetchStoredParticipants: async () => ({ statuses: { a: '未定', b: '未定' }, guests: [] }),
      formatLocalUpdatedAt: value => value || '',
      saveAllParticipants: async (_id, value) => { sent = value; return { statuses: { a: value.statuses.a, b: '参加' }, guests: [] }; }
    }
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(ParticipantManager, { meetingId: 'meeting', initialMembers: members, initialParticipants: [] })); });
  const statusSelects = () => renderer.root.findAllByType('select');
  assert.ok(statusSelects().every(select => select.props.disabled));
  await act(async () => memberRead.resolve(members));
  assert.equal(statusSelects()[0].props.disabled, false);
  await act(async () => statusSelects()[0].props.onChange({ target: { value: '欠席' } }));
  assert.equal(statusSelects()[0].props.value, '欠席');
  const save = renderer.root.findAllByType('button').find(button => button.props.onClick?.name === 'saveParticipants');
  await act(async () => save.props.onClick());
  assert.deepEqual(sent.statuses, { a: '欠席' });
  assert.equal(Object.hasOwn(sent, 'guests'), false);
  assert.equal(statusSelects()[1].props.value, '参加');
  assert.equal(memberReads, 1, 'typing/saving must not trigger member rehydration');
  await act(async () => renderer.unmount());
});

test('guest removal is blocked while a participant save is in flight and clears old success after saving', async () => {
  const pending = deferred();
  const guest = { id: 'guest', name: 'Guest', company: '', industry: '', type: '新規', branchName: '' };
  const stored = { statuses: { a: '未定', b: '未定' }, guests: [guest] };
  const { ParticipantManager } = load('components/admin/participant-manager.tsx', {
    '@/lib/data/member-overrides': { fetchManagedMembers: async () => members },
    '@/lib/data/member-sort': { sortMembersForDirectory: value => value },
    '@/lib/data/participant-storage': { fetchStoredParticipants: async () => stored, formatLocalUpdatedAt: value => value || '', saveAllParticipants: () => pending.promise }
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(ParticipantManager, { meetingId: 'meeting', initialMembers: members, initialParticipants: [] })); });
  await act(async () => renderer.root.findAllByType('button').find(button => button.children.includes('参加者一覧を見る')).props.onClick());
  const remove = () => renderer.root.findAllByType('button').find(button => button.props['aria-label'] === 'Guestを削除');
  assert.ok(remove());
  let saving;
  await act(async () => { saving = renderer.root.findAllByType('button').find(button => button.props.onClick?.name === 'saveParticipants').props.onClick(); });
  assert.equal(renderer.root.findByType('fieldset').props.disabled, true);
  await act(async () => remove().props.onClick());
  assert.ok(remove(), 'direct stale event cannot remove guest during save');
  await act(async () => { pending.resolve(stored); await saving; });
  assert.match(text(renderer), /参加者情報を保存しました/);
  await act(async () => remove().props.onClick());
  assert.equal(remove(), undefined);
  assert.doesNotMatch(text(renderer), /参加者情報を保存しました/);
  await act(async () => renderer.unmount());
});
