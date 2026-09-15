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
  loaded.require = (id) => Object.hasOwn(mocks, id) ? mocks[id] : id === '@/lib/table-assignment/manual-addition' ? load('lib/table-assignment/manual-addition.ts') : id === '@/lib/table-assignment/snapshot' ? load('lib/table-assignment/snapshot.ts') : id === '@/lib/table-assignment/member-identity' ? load('lib/table-assignment/member-identity.ts') : id === '@/lib/data/table-assignment-recovery' ? load('lib/data/table-assignment-recovery.ts') : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
  }).outputText, filename);
  return loaded.exports;
}

const csvExport = load('lib/data/csv-export.ts');
const { EditableTableAssignment: Editor } = load('components/table-assignment/editable-table-assignment.tsx', { '@/lib/data/csv-export': csvExport });
const seat = (id) => ({ member: { id, name: id }, isLeader: false });
const initial = [{ tableName: 'Aテーブル', seats: [seat('one'), seat('two')] }, { tableName: 'Bテーブル', seats: [seat('three')] }];
const names = (tables) => tables.map((table) => table.seats.map((s) => s.member.id));
const text = (root) => JSON.stringify(root.toJSON());
function storage() {
  const values = new Map();
  global.window = { localStorage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), get length() { return values.size; }, key: (index) => [...values.keys()][index] ?? null }, confirm: () => true, addEventListener() {}, removeEventListener() {}, setInterval() { return 1; }, clearInterval() {} };
  global.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
  return values;
}
function saveButton(renderer) { return renderer.root.findAllByType('button').find((button) => button.props.onClick?.name === 'saveTables'); }

test('editing survives parent prop refresh, navigation, and an async save', async () => {
  const values = storage();
  let persisted;
  const props = { initialTables: initial, storageKey: 'draft', onSave: async (tables) => { persisted = tables; } };
  let renderer;
  await act(async () => { renderer = create(React.createElement(Editor, props)); });
  await act(async () => renderer.root.findAllByType('select')[0].props.onChange({ target: { value: 'Bテーブル' } }));
  assert.deepEqual(names(JSON.parse(values.get('draft')).tables), [['two'], ['three', 'one']]);
  await act(async () => renderer.update(React.createElement(Editor, { ...props, initialTables: structuredClone(initial) })));
  await act(async () => saveButton(renderer).props.onClick());
  assert.deepEqual(names(persisted), [['two'], ['three', 'one']]);
  await act(async () => renderer.unmount());
  await act(async () => { renderer = create(React.createElement(Editor, props)); });
  await act(async () => saveButton(renderer).props.onClick());
  assert.deepEqual(names(persisted), [['two'], ['three', 'one']]);
  await act(async () => renderer.unmount());
});

test('failed server save never reports success, remains retryable; quota cannot cancel successful save', async () => {
  storage();
  let fail = true;
  let renderer;
  await act(async () => { renderer = create(React.createElement(Editor, { initialTables: initial, storageKey: 'draft', onSave: async () => { if (fail) throw new Error('Server refused'); } })); });
  await act(async () => saveButton(renderer).props.onClick());
  assert.match(text(renderer), /Server refused/);
  assert.doesNotMatch(text(renderer), /保存しました/);
  fail = false;
  window.localStorage.setItem = () => { throw new Error('quota'); };
  await act(async () => saveButton(renderer).props.onClick());
  assert.match(text(renderer), /保存しました/);
  await act(async () => renderer.unmount());
});

test('remote newer saved version wins over stale local draft; explicit regeneration ignores draft', async () => {
  const values = storage();
  values.set('draft', JSON.stringify({ tables: [{ tableName: 'Aテーブル', seats: [seat('stale')] }], updatedAt: '2025-01-01' }));
  let persisted;
  let renderer;
  const props = { initialTables: initial, storageKey: 'draft', savedAt: '2026-01-01', onSave: async (tables) => { persisted = tables; } };
  await act(async () => { renderer = create(React.createElement(Editor, props)); });
  await act(async () => saveButton(renderer).props.onClick());
  assert.deepEqual(names(persisted), names(initial));
  await act(async () => renderer.unmount());
  values.set('draft', JSON.stringify({ tables: [], updatedAt: '2099-01-01' }));
  await act(async () => { renderer = create(React.createElement(Editor, { ...props, restoreDraft: false })); });
  await act(async () => saveButton(renderer).props.onClick());
  assert.deepEqual(names(persisted), names(initial));
  await act(async () => renderer.unmount());
});

test('manager generates only on request and uses actual previous two meetings, never current/future history', async () => {
  storage();
  let participantListener;
  let generated = 0;
  let history;
  const meetings = [
    { id: 'current', date: '2026-09-01' }, { id: 'old', date: '2026-06-01' },
    { id: 'draft-meeting', date: '2026-08-20', status: '下書き' },
    { id: 'previous', date: '2026-08-01' }, { id: 'older', date: '2026-07-01' }, { id: 'future', date: '2026-10-01' }
  ];
  const publication = (id) => ({ tables: [{ tableName: id, seats: [] }], publishedAt: '2026-01-01' });
  const { TableAssignmentManager: Manager } = load('components/admin/table-assignment-manager.tsx', {
    '@/components/table-assignment/editable-table-assignment': { EditableTableAssignment: Editor },
    '@/lib/data/member-overrides': { fetchManagedMembers: async (members) => members },
    '@/lib/data/participant-storage': {
      fetchStoredParticipants: async () => ({}), formatLocalUpdatedAt: (value) => value ?? '',
      storedParticipantsValueToParticipants: () => [{ status: '参加' }],
      subscribeStoredParticipants: (_, listener) => { participantListener = listener; return () => {}; }
    },
    '@/lib/data/meeting-storage': { fetchMeetings: async () => meetings },
    '@/lib/data/table-assignment-publication': {
      fetchSavedTableAssignments: async () => ({ older: { tables: [{ tableName: 'older', seats: [] }], updatedAt: '' } }),
      fetchPublishedTableAssignments: async () => Object.fromEntries(['old', 'previous', 'current', 'future', 'draft-meeting'].map((id) => [id, publication(id)])),
      saveTableAssignment: async () => {}, publishTableAssignment: async () => ({ publishedAt: '' })
    },
    '@/lib/table-assignment/generator': { generateTableAssignment: (_, __, tables) => { generated++; history = tables; return { tables: initial, score: 0, warnings: [] }; } }
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(Manager, { meetingId: 'current', initialMembers: [], initialParticipants: [], initialMeetings: meetings, initialSeatsPerTable: 5 })); });
  assert.equal(generated, 0);
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  assert.equal(generated, 1);
  assert.deepEqual(history.map((table) => table.tableName), ['previous', 'older']);
  assert.match(text(renderer), /2026-08-01、2026-07-01/);
  assert.match(text(renderer), /重複は確認できません/);
  assert.doesNotMatch(text(renderer), /2026-08-20/);
  await act(async () => participantListener());
  assert.equal(generated, 1, 'participant refresh must not regenerate or reset the editor');
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  assert.equal(generated, 2, 'same-size generation button must still work');
  await act(async () => renderer.root.findAllByType('select').find((select) => select.props.value === 'Aテーブル').props.onChange({ target: { value: 'Bテーブル' } }));
  await act(async () => renderer.update(React.createElement(Manager, { meetingId: 'current', initialMembers: [], initialParticipants: [], initialMeetings: structuredClone(meetings), initialSeatsPerTable: 5 })));
  assert.equal(generated, 2);
  await act(async () => saveButton(renderer).props.onClick());
  assert.deepEqual(names(JSON.parse(window.localStorage.getItem('draft-table-assignment-current')).tables), [['two'], ['three', 'one']]);
  await act(async () => renderer.unmount());
});

test('shared draft saves preserve other meetings and reject stale same-meeting edits', async () => {
  let database = { a: { tables: initial, updatedAt: 'version-a' }, b: { tables: initial, updatedAt: 'version-b' } };
  const { saveTableAssignment } = load('lib/data/table-assignment-publication.ts', {
    '@/lib/data/shared-state': {
      updateSharedState: async (_, update) => { database = update(database); return database; },
      fetchSharedState: async () => database
    }
  });
  await saveTableAssignment('a', { tables: [], updatedAt: 'next-a' }, 'version-a');
  assert.equal(database.b.updatedAt, 'version-b');
  await assert.rejects(saveTableAssignment('a', { tables: initial, updatedAt: 'stale-write' }, 'version-a'), /別の運営担当者/);
  assert.equal(database.a.updatedAt, 'next-a');
});

test('member selector exposes published ended history and defaults to nearest upcoming, then most recent history', async () => {
  const ended = { id: 'ended', date: '2001-06-01', status: '終了' };
  const oldConfirmed = { id: 'old-confirmed', date: '2000-06-01', status: '確定' };
  const expiredUnpublished = { id: 'expired-unpublished', date: '1999-06-01', status: '確定' };
  const upcoming = { id: 'upcoming', date: '2999-07-01', status: '確定' };
  const farther = { id: 'farther', date: '2999-08-01', status: '確定' };
  for (const hasUpcoming of [true, false]) {
    storage();
    Object.assign(window, { addEventListener() {}, removeEventListener() {}, setInterval() { return 1; }, clearInterval() {} });
    const meetings = [oldConfirmed, expiredUnpublished, ended, ...(hasUpcoming ? [farther, upcoming] : [])];
    const { PublishedTableAssignmentSelector: Selector } = load('components/member/published-table-assignment-selector.tsx', {
      '@/lib/data/participant-storage': { formatLocalUpdatedAt: () => '' },
      '@/lib/data/meeting-storage': { fetchMeetings: async () => meetings },
      '@/lib/data/table-assignment-publication': {
        fetchPublishedTableAssignments: async () => ({ ended: { tables: initial, publishedAt: '' }, 'old-confirmed': { tables: initial, publishedAt: '' } }),
        subscribePublishedTableAssignments: () => () => {}
      }
    });
    let renderer;
    await act(async () => { renderer = create(React.createElement(Selector, { meetings })); });
    const heading = () => renderer.root.findByType('h2').children.join('');
    assert.match(heading(), hasUpcoming ? /2999年7月/ : /2001年6月/);
    const buttons = renderer.root.findAllByType('button');
    assert.equal(buttons.length, hasUpcoming ? 4 : 2);
    assert.doesNotMatch(text(renderer), /1999-06-01/);
    const historicalButton = buttons.find((button) => button.findAllByType('p').some((p) => p.children.join('').includes('2000年6月')));
    await act(async () => historicalButton.props.onClick());
    assert.match(heading(), /2000年6月/);
    await act(async () => renderer.unmount());
  }
});

test('admin dashboard counts canonical members, next confirmed attendance and future meetings; read failure shows no fake totals', async () => {
  storage();
  Object.assign(window, { addEventListener() {}, removeEventListener() {} });
  let fail = false;
  let attendanceMeeting;
  const { AdminDashboard } = load('components/admin/admin-dashboard.tsx', {
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
    '@/lib/data/member-overrides': { fetchManagedMembers: async () => {
      if (fail) throw new Error('Fixture unavailable');
      return [{ id: 'one', status: '在籍' }, { id: 'two', status: '在籍' }, { id: 'paused', status: '休会' }];
    } },
    '@/lib/data/meeting-storage': { fetchMeetings: async () => [
      { id: 'expired', date: '2000-01-01', status: '確定' },
      { id: 'draft', date: '2999-01-01', status: '下書き' },
      { id: 'next', date: '2999-03-01', status: '確定', title: '次回' },
      { id: 'later', date: '2999-04-01', status: '確定' }
    ] },
    '@/lib/data/participant-storage': { fetchStoredParticipants: async (id) => {
      attendanceMeeting = id;
      return { statuses: { one: '参加', two: '未定', paused: '欠席', deleted: '参加' }, guests: [{ id: 'g1' }, { id: 'g2' }] };
    } }
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(AdminDashboard, { initialMembers: [{ id: 'fake', status: '在籍' }], initialMeetings: [] })); });
  assert.equal(attendanceMeeting, 'next');
  const cards = renderer.root.findAllByType('a');
  assert.equal(cards[0].findAllByType('p')[1].children.join(''), '2名');
  assert.equal(cards[1].findAllByType('p')[1].children.join(''), '3名');
  assert.equal(cards[2].findAllByType('p')[1].children.join(''), '2件');
  assert.equal(cards[1].props.href, '/admin/meetings/next/participants');
  fail = true;
  await act(async () => renderer.root.findByType('button').props.onClick());
  assert.match(text(renderer), /Fixture unavailable/);
  assert.equal(renderer.root.findAllByType('a').length, 0);
  await act(async () => renderer.unmount());
});

test('gallery rotation supports explicit pause, keyboard focus pause and reduced-motion preference', async () => {
  for (const reducedMotion of [false, true]) {
    storage();
    let timer = null;
    Object.assign(window, {
      addEventListener() {}, removeEventListener() {},
      matchMedia: () => ({ matches: reducedMotion, addEventListener() {}, removeEventListener() {} }),
      setInterval(callback) { timer = callback; return 1; }, clearInterval() { timer = null; }
    });
    const images = [{ id: 'a', title: 'A', alt: 'A', imageUrl: '/a.jpg' }, { id: 'b', title: 'B', alt: 'B', imageUrl: '/b.jpg' }];
    const { GallerySlider } = load('components/gallery/gallery-slider.tsx', {
      'next/image': { default: (props) => React.createElement('img', props) },
      '@/lib/data/gallery-overrides': { fetchGalleryImages: async () => images, subscribeGalleryImages: () => () => {} }
    });
    let renderer;
    await act(async () => { renderer = create(React.createElement(GallerySlider, { images })); });
    assert.equal(Boolean(timer), !reducedMotion);
    if (!reducedMotion) {
      await act(async () => renderer.root.findByProps({ 'aria-label': '写真の自動切り替えを停止' }).props.onClick());
      assert.equal(timer, null);
    }
    await act(async () => renderer.root.findByProps({ 'aria-label': '写真の自動切り替えを再開' }).props.onClick());
    assert.equal(typeof timer, 'function');
    await act(async () => renderer.root.findByProps({ role: 'region' }).props.onFocusCapture());
    assert.equal(timer, null);
    assert.equal(renderer.root.findAllByType('img').filter((img) => img.props['aria-hidden']).length, 1);
    await act(async () => renderer.unmount());
  }
});

test('member confirmation opens native modal with cancel focus; Escape closes and restores trigger focus', async () => {
  storage();
  const person = { id: 'member', name: 'Member', memberNo: '1', status: '在籍', isVisible: true };
  const { MemberManagement } = load('components/admin/member-management.tsx', {
    'next/image': { default: (props) => React.createElement('img', props) },
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
    '@/lib/data/csv-export': csvExport,
    '@/lib/data/member-sort': { sortMembersForDirectory: (members) => members },
    '@/lib/data/member-overrides': { fetchManagedMembers: async () => [person] }
  });
  let opened = 0, closed = 0, cancelFocused = 0, triggerFocused = 0;
  const dialog = { showModal() { opened++; }, close() { closed++; }, querySelector: () => ({ focus() { cancelFocused++; } }) };
  let renderer;
  await act(async () => { renderer = create(React.createElement(MemberManagement, { initialMembers: [] }), { createNodeMock: (element) => element.type === 'dialog' ? dialog : null }); });
  const trigger = renderer.root.findAllByType('button').find((button) => button.children.includes('削除'));
  await act(async () => trigger.props.onClick({ currentTarget: { isConnected: true, focus() { triggerFocused++; } } }));
  assert.equal(opened, 1);
  assert.equal(cancelFocused, 1);
  await act(async () => renderer.root.findByType('dialog').props.onCancel({ preventDefault() { throw new Error('Escape unexpectedly prevented'); } }));
  assert.equal(renderer.root.findAllByType('dialog').length, 0);
  assert.equal(closed, 1);
  assert.equal(triggerFocused, 1);
  await act(async () => renderer.unmount());
});

test('table CSV export neutralizes formula-like names through shared csvCell', async () => {
  storage();
  let downloaded;
  window.URL = { createObjectURL(blob) { downloaded = blob; return 'blob:fixture'; }, revokeObjectURL() {} };
  global.document = { createElement: () => ({ click() {} }) };
  let renderer;
  await act(async () => { renderer = create(React.createElement(Editor, { initialTables: [{ tableName: 'Aテーブル', seats: [seat('=SUM(1,2)')] }], storageKey: 'csv-test' })); });
  await act(async () => renderer.root.findAllByType('button').find((button) => button.props.onClick?.name === 'exportCsv').props.onClick());
  assert.match(await downloaded.text(), /"\t=SUM\(1,2\)"/);
  await act(async () => renderer.unmount());
  delete global.document;
});

test('saved and published seating snapshots omit embedded images and contacts while preserving matching attributes', async () => {
  storage();
  window.dispatchEvent = () => {};
  global.CustomEvent = class { constructor(type) { this.type = type; } };
  const member = { id: 'm1', memberNo: '10', name: 'Name', company: 'Company', industry: 'Industry', majorIndustry: 'その他', position: '一般会員', isTableLeader: true, status: '在籍', isVisible: true, profileImageUrl: 'data:image/png;base64,LARGE_IMAGE', bio: 'LONG_BIO', email: 'private@example.com', phone: 'private-phone', facebookUrl: 'private-facebook', instagramUrl: 'private-instagram', websiteUrl: 'private-website', kana: 'private-kana' };
  const tables = [{ tableName: 'Aテーブル', seats: [{ member, isLeader: true }, { guestName: 'Guest', guestCompany: 'Guest company', isLeader: false }] }];
  const database = {
    'table-assignment-drafts': { older: { tables, updatedAt: 'old' } },
    'table-assignments': { older: { meetingId: 'older', tables, publishedAt: 'old' } }
  };
  const { saveTableAssignment, publishTableAssignment } = load('lib/data/table-assignment-publication.ts', {
    '@/lib/data/shared-state': { updateSharedState: async (key, update) => { database[key] = update(database[key]); return database[key]; } }
  });
  await saveTableAssignment('current', { tables, updatedAt: 'now' }, null);
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    assert.match(url, /\/current\/table-assignment-publication$/);
    assert.deepEqual(JSON.parse(options.body), { expectedSavedRevision: 'now', expectedPublishedRevision: null });
    const publication = { meetingId: 'current', tables: database['table-assignment-drafts'].current.tables, publishedAt: 'published-now' };
    database['table-assignments'].current = publication;
    return new Response(JSON.stringify({ publication }), { status: 200 });
  };
  await publishTableAssignment('current', 'now', null);
  global.fetch = originalFetch;
  for (const records of [database['table-assignment-drafts'], { current: database['table-assignments'].current }]) {
    assert.doesNotMatch(JSON.stringify(records), /LARGE_IMAGE|LONG_BIO|private-/);
    assert.doesNotMatch(JSON.stringify(records), /private@example/);
    for (const record of Object.values(records)) {
      const snapshot = record.tables[0].seats[0].member;
      for (const key of ['id', 'memberNo', 'name', 'company', 'industry', 'majorIndustry', 'position', 'isTableLeader']) assert.equal(snapshot[key], member[key]);
      assert.equal(record.tables[0].seats[1].guestName, 'Guest');
    }
  }
  assert.equal(member.profileImageUrl, 'data:image/png;base64,LARGE_IMAGE', 'original member data must not be mutated');
});

test('legacy normal/past/size-specific/publication records remain discoverable without writing or inventing history', async () => {
  const values = storage();
  const july = 'meeting-2026-07';
  const august = 'meeting-2026-08';
  values.set(`nm_current_table_assignment_${july}`, JSON.stringify({ tables: initial, updatedAt: '2026-07-01' }));
  values.set(`past-table-assignment-${july}`, JSON.stringify({ tables: initial, updatedAt: '2026-07-02' }));
  values.set(`draft-table-assignment-${july}-8`, JSON.stringify({ tables: initial, updatedAt: '2026-07-03' }));
  values.set(`latest-table-assignment-${july}-5`, JSON.stringify({ tables: initial, updatedAt: '2026-07-01' }));
  values.set('nm_published_table_assignments', JSON.stringify({ [august]: { tables: initial, publishedAt: '2026-08-01' } }));
  values.set('past-table-assignment-invalid', JSON.stringify({ tables: [{ tableName: 'A', seats: [null] }] }));
  const before = [...values];
  const recovery = load('lib/data/table-assignment-recovery.ts');
  const candidates = recovery.readTableRecoveryCandidates(july);
  assert.equal(candidates.length, 4);
  assert.equal(candidates[0].seatsPerTable, 8);
  assert.deepEqual(new Set(recovery.readTableRecoveryMeetingIds()), new Set([july, august]));
  assert.deepEqual(recovery.readTableRecoveryCandidates('meeting-never-saved'), []);
  assert.deepEqual([...values], before, 'discovery never rewrites the evidence');
});

test('empty shared publication fetch cannot overwrite old browser-only published history', async () => {
  const values = storage();
  const original = JSON.stringify({ 'meeting-2026-07': { tables: initial, publishedAt: '2026-07-17' } });
  values.set('nm_published_table_assignments', original);
  const { fetchPublishedTableAssignments } = load('lib/data/table-assignment-publication.ts', {
    '@/lib/data/shared-state': { fetchSharedState: async () => null }
  });
  assert.deepEqual(await fetchPublishedTableAssignments(), {});
  assert.equal(values.get('nm_published_table_assignments'), original);
  assert.equal(values.get('nm_published_table_assignments_shared_v2'), '{}');
  assert.equal(load('lib/data/table-assignment-recovery.ts').readTableRecoveryCandidates('meeting-2026-07').length, 1);
});

test('legacy recovery preview only loads editor; shared save requires explicit Save and preserves original evidence', async () => {
  const values = storage();
  const sourceKey = 'past-table-assignment-july';
  const source = JSON.stringify({ tables: initial, updatedAt: '2026-07-17' });
  values.set(sourceKey, source);
  values.set('draft-table-assignment-july', source);
  let saves = 0;
  const meetings = [{ id: 'july', date: '2026-07-17', status: '終了' }];
  const { TableAssignmentManager: Manager } = load('components/admin/table-assignment-manager.tsx', {
    '@/components/table-assignment/editable-table-assignment': { EditableTableAssignment: Editor },
    '@/lib/data/member-overrides': { fetchManagedMembers: async () => [] },
    '@/lib/data/participant-storage': { fetchStoredParticipants: async () => ({}), formatLocalUpdatedAt: (value) => value ?? '', storedParticipantsValueToParticipants: () => [], subscribeStoredParticipants: () => () => {} },
    '@/lib/data/meeting-storage': { fetchMeetings: async () => meetings },
    '@/lib/data/table-assignment-publication': { fetchSavedTableAssignments: async () => ({}), fetchPublishedTableAssignments: async () => ({}), saveTableAssignment: async () => { saves++; } },
    '@/lib/table-assignment/generator': { generateTableAssignment: () => { throw new Error('Recovery must not regenerate history'); } }
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(Manager, { meetingId: 'july', initialMembers: [], initialParticipants: [], initialMeetings: meetings, initialSeatsPerTable: 5 })); });
  assert.equal(saves, 0);
  assert.equal(renderer.root.findByType(Editor).props.initialTables.length, 2, 'manager restores and verifies the browser-only draft before showing the editor');
  let confirmations = 0;
  window.confirm = () => { confirmations++; return false; };
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  assert.equal(confirmations, 1, 'generation must confirm even when parent tables are empty');
  assert.equal(values.get('draft-table-assignment-july'), source);
  const restore = renderer.root.findAllByType('button').find((button) => button.children.includes('この内容を編集欄へ読み込む'));
  await act(async () => restore.props.onClick());
  assert.equal(confirmations, 2);
  assert.equal(values.get('draft-table-assignment-july'), source);
  window.confirm = () => true;
  await act(async () => restore.props.onClick());
  assert([...values].some(([key, value]) => key.startsWith('nm_table_assignment_recovery_july::') && value === source), 'replacement preserves the previous draft');
  assert.equal(saves, 0);
  assert.deepEqual(renderer.root.findByType(Editor).props.initialTables.map((table) => table.seats.map((seat) => seat.member.name)), names(initial));
  await act(async () => saveButton(renderer).props.onClick());
  assert.equal(saves, 1);
  assert.equal(values.get(sourceKey), source);
  await act(async () => renderer.unmount());
});

test('draft backup failure prevents replacing the only browser copy', () => {
  const values = storage();
  const raw = JSON.stringify({ tables: initial, updatedAt: '2026-07-17' });
  values.set('draft-table-assignment-july', raw);
  window.localStorage.setItem = () => { throw new Error('QuotaExceeded'); };
  assert.throws(() => load('lib/data/table-assignment-recovery.ts').preserveTableDraft('july'), /保管できません/);
  assert.equal(values.get('draft-table-assignment-july'), raw);
});

test('focus/timer attendance refresh never resets editor; generation refetches all inputs, locks duplicates and preserves edits on failure', async () => {
  storage();
  const listeners = {};
  let tick;
  window.addEventListener = (name, callback) => { listeners[name] = callback; };
  document.addEventListener = (name, callback) => { listeners[name] = callback; };
  window.setInterval = (callback, delay) => { assert.equal(delay, 30000); tick = callback; return 1; };
  let version = 1, generations = 0, attendanceCalls = 0, fail = false, gate = null;
  let received;
  const meetings = [{ id: 'current', date: '2026-09-01', status: '確定' }, { id: 'previous', date: '2026-08-01', status: '終了' }];
  const { TableAssignmentManager: Manager } = load('components/admin/table-assignment-manager.tsx', {
    '@/components/table-assignment/editable-table-assignment': { EditableTableAssignment: Editor },
    '@/lib/data/member-overrides': { fetchManagedMembers: async () => Array.from({ length: version }, (_, i) => ({ id: `m${i}`, name: `m${i}` })) },
    '@/lib/data/participant-storage': {
      fetchStoredParticipants: async () => { attendanceCalls++; if (gate) await gate; if (fail) throw new Error('Read failed'); return { statuses: Object.fromEntries(Array.from({ length: version }, (_, i) => [`m${i}`, '参加'])) }; },
      formatLocalUpdatedAt: () => '', subscribeStoredParticipants: () => () => {},
      storedParticipantsValueToParticipants: (_, members, __, stored) => members.filter((member) => stored?.statuses?.[member.id] === '参加').map((member) => ({ memberId: member.id, status: '参加' }))
    },
    '@/lib/data/meeting-storage': { fetchMeetings: async () => meetings },
    '@/lib/data/table-assignment-publication': { fetchSavedTableAssignments: async () => ({}), fetchPublishedTableAssignments: async () => ({ previous: { tables: [{ tableName: `history-${version}`, seats: initial[0].seats }], publishedAt: '' } }) },
    '@/lib/table-assignment/generator': { generateTableAssignment: (participants, members, history) => { generations++; received = { participants, members, history }; return { tables: initial, score: 0, warnings: [] }; } }
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(Manager, { meetingId: 'current', initialMembers: [], initialParticipants: [], initialMeetings: meetings, initialSeatsPerTable: 5 })); });
  version = 2;
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  assert.equal(received.participants.length, 2);
  assert.equal(received.members.length, 2);
  assert.equal(received.history[0].tableName, 'history-2');
  await act(async () => renderer.root.findAllByType('select')[1].props.onChange({ target: { value: 'Bテーブル' } }));
  const before = window.localStorage.getItem('draft-table-assignment-current');
  version = 3;
  await act(async () => listeners.focus());
  await act(async () => listeners.visibilitychange());
  await act(async () => tick());
  assert.match(text(renderer), /参加設定:.*3.*名/);
  assert.equal(generations, 1);
  assert.equal(window.localStorage.getItem('draft-table-assignment-current'), before);
  fail = true;
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  assert.match(text(renderer), /Read failed/);
  assert.equal(generations, 1);
  assert.equal(window.localStorage.getItem('draft-table-assignment-current'), before);
  fail = false;
  let release;
  gate = new Promise((resolve) => { release = resolve; });
  let pending;
  const startCount = attendanceCalls;
  await act(async () => { pending = renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  assert.equal(attendanceCalls, startCount + 1);
  await act(async () => { release(); await pending; });
  assert.equal(generations, 2);
  await act(async () => renderer.unmount());
});
