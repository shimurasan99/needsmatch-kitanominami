const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(relative, mocks = {}) {
  const filename = path.join(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('@/') ? load(`${id.slice(2)}.ts`, mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  return loaded.exports;
}
const member = (id, memberNo, name) => ({ id, memberNo, name, status: '在籍' });
const original = member('m-4', '4727', '伊藤 瞳');
const current = [member('m-4', '656', '飛山 佳枝'), member('m-5', '4727', '伊藤 瞳')];
const memberSeat = { member: original, isLeader: true };
function helpers(latest, overrides = {}) {
  const writes = [];
  const storage = {
    fetchStoredParticipants: async () => latest,
    saveMemberAttendance: async (...args) => { writes.push(['member', ...args]); return { statuses: { [args[1]]: '欠席' } }; },
    saveAllParticipants: async (...args) => { writes.push(['guests', ...args]); return { ...latest, ...args[1] }; },
    ...overrides
  };
  return { ...load('lib/table-assignment/manual-absence.ts', { '@/lib/data/participant-storage': storage }), writes };
}

test('member absence resolves historical positional ID by unique number/name and submits only that current member revision', async () => {
  const latest = { statuses: { 'm-4': '参加', 'm-5': '参加' }, versions: { 'm-4': 'other-version', 'm-5': 'correct-version' } };
  const before = structuredClone(latest);
  const { markSeatAbsent, writes } = helpers(latest);
  const result = await markSeatAbsent('meeting', memberSeat, current);
  assert.deepEqual(writes, [['member', 'meeting', 'm-5', '欠席', 'correct-version']]);
  assert.equal(result.attendanceUpdated, true);
  assert.deepEqual(latest, before);
  assert.equal(memberSeat.member.id, 'm-4', 'historical source must stay unchanged');
});

test('unknown, ambiguous, or same-ID/different-person members cannot update attendance', async () => {
  for (const members of [[current[0]], [current[1], { ...current[1], id: 'duplicate' }], [{ ...current[1], memberNo: '' }], [current[1], { ...current[0], id: 'm-5' }]]) {
    const { markSeatAbsent, writes } = helpers({});
    await assert.rejects(markSeatAbsent('meeting', memberSeat, members), /確認|重複/);
    assert.equal(writes.length, 0);
  }
});

test('guest absence matches displayed branch/type fallback, preserves list/order, and uses current guest CAS', async () => {
  for (const target of [
    { id: 'g', name: ' ゲスト ', company: '会社', branchName: '', type: '新規' },
    { id: 'g', name: ' ゲスト ', company: '', branchName: '他支部名', type: '他支部' },
    { id: 'g', name: ' ゲスト ', company: '', branchName: '', type: '新規' }
  ]) {
    const other = { id: 'other', name: '別ゲスト', company: '', type: '新規' };
    const latest = { statuses: { 'm-1': '参加' }, guests: [other, target], guestsUpdatedAt: 'guest-current-version' };
    const before = structuredClone(latest);
    const { markSeatAbsent, writes } = helpers(latest);
    const result = await markSeatAbsent('meeting', { guestName: 'ゲスト', guestCompany: ` ${target.company || target.branchName || target.type} `, isLeader: false }, []);
    assert.equal(result.attendanceUpdated, true);
    assert.deepEqual(writes, [['guests', 'meeting', { statuses: {}, expectedVersions: {}, guests: [other, { ...target, status: '欠席' }], guestsUpdatedAt: 'guest-current-version' }]]);
    assert.deepEqual(latest, before, 'input attendance and guest list must be immutable');
  }
});

test('unregistered manual guest removes placement only; ambiguous guest must throw without writing', async () => {
  const seat = { guestName: 'Manual', guestCompany: 'Company', isLeader: false };
  for (const latest of [null, { guests: [] }]) {
    const { markSeatAbsent, writes } = helpers(latest);
    assert.deepEqual(await markSeatAbsent('meeting', seat, []), { participants: latest, attendanceUpdated: false });
    assert.equal(writes.length, 0);
  }
  const guests = [{ id: 'a', name: 'Manual', company: 'Company' }, { id: 'b', name: 'Manual', company: 'Company' }];
  const { markSeatAbsent, writes } = helpers({ guests });
  await assert.rejects(markSeatAbsent('meeting', seat, []), /複数/);
  assert.equal(writes.length, 0);
});

test('read failure, write conflict, and uncertain committed save propagate instead of permitting seat removal', async () => {
  for (const error of ['読取失敗', '409 conflict', '保存後の確認失敗']) {
    const failure = async () => { throw new Error(error); };
    const { markSeatAbsent } = helpers({}, error === '読取失敗' ? { fetchStoredParticipants: failure } : { saveMemberAttendance: failure });
    await assert.rejects(markSeatAbsent('meeting', memberSeat, current), new RegExp(error));
  }
  const { markSeatAbsent } = helpers({ guests: [{ id: 'g', name: 'Guest', company: 'Company' }] }, { saveAllParticipants: async () => { throw new Error('guest conflict'); } });
  await assert.rejects(markSeatAbsent('meeting', { guestName: 'Guest', guestCompany: 'Company' }, []), /guest conflict/);
});

test('seat removal is immutable, preserves empty tables/order, and refuses a replaced or ambiguous target', () => {
  const { removeSeatFromTable } = helpers({});
  const guest = { guestName: 'Guest', guestCompany: 'Company', isLeader: false };
  const tables = [{ tableName: 'Aテーブル', seats: [memberSeat, guest] }, { tableName: 'Bテーブル', seats: [] }];
  const before = structuredClone(tables);
  const removed = removeSeatFromTable(tables, 'Aテーブル', 0, structuredClone(memberSeat));
  assert.deepEqual(removed, [{ tableName: 'Aテーブル', seats: [guest] }, { tableName: 'Bテーブル', seats: [] }]);
  assert.deepEqual(removeSeatFromTable(removed, 'Aテーブル', 0, guest), [{ tableName: 'Aテーブル', seats: [] }, { tableName: 'Bテーブル', seats: [] }]);
  assert.deepEqual(tables, before);
  for (const [name, index, expected] of [['missing', 0, memberSeat], ['Aテーブル', -1, memberSeat], ['Aテーブル', 0.5, memberSeat], ['Aテーブル', 9, memberSeat], ['Aテーブル', 0, guest], ['Aテーブル', 0, { ...memberSeat, member: { ...original, name: '別人' } }]]) {
    assert.throws(() => removeSeatFromTable(tables, name, index, expected), /変更/);
  }
  assert.throws(() => removeSeatFromTable([...tables, tables[0]], 'Aテーブル', 0, memberSeat), /変更/);
});
