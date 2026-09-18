const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.join(__dirname, '../lib/table-assignment/manual-addition.ts');
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { getUnassignedMembers, addMemberToTable, addGuestToTable, nextTableName, addEmptyTable } = loaded.exports;
const member = (id, extra = {}) => ({ id, name: `氏名${id}`, memberNo: `番号${id}`, status: '在籍', isTableLeader: false, ...extra });
const seat = (person) => ({ member: person, isLeader: false });

test('manual addition preserves every existing seat and order, appends an independent snapshot even beyond capacity', () => {
  const first = { tableName: 'A', seats: [seat(member('a')), { guestName: 'ゲスト', guestCompany: '会社', isLeader: false }] };
  const second = { tableName: 'B', seats: Array.from({ length: 8 }, (_, i) => seat(member(`b${i}`))) };
  const tables = [first, second];
  const before = JSON.stringify(tables);
  const nextMember = member('new', { isTableLeader: true });
  const result = addMemberToTable(tables, nextMember, 'B');
  assert.equal(JSON.stringify(tables), before);
  assert.notEqual(result, tables);
  assert.equal(result[0], first);
  assert.notEqual(result[1], second);
  assert.equal(result[1].seats.length, 9);
  second.seats.forEach((old, i) => assert.equal(result[1].seats[i], old));
  assert.deepEqual(result[1].seats[8], { member: nextMember, isLeader: true });
  assert.notEqual(result[1].seats[8].member, nextMember);
  nextMember.name = 'changed';
  assert.notEqual(result[1].seats[8].member.name, 'changed');
});

test('same id rejects duplicates with missing identity; old or isolated ids match only both identity fields', () => {
  const current = member('current', { memberNo: '9147', name: '中本 怜男' });
  for (const old of [
    { ...current, id: 'old' },
    { ...current, id: 'history-unresolved:old' },
    { ...current, memberNo: '', name: '' },
    { ...current, memberNo: ' 9147 ', name: ' 中本 怜男 ' }
  ]) {
    const tables = [{ tableName: 'A', seats: [seat(old)] }];
    assert.deepEqual(getUnassignedMembers(tables, [current]), []);
    assert.throws(() => addMemberToTable(tables, current, 'A'), /既に/);
  }
  for (const other of [member('other', { memberNo: '9147', name: '佐藤 正人' }), member('other', { memberNo: 'other', name: current.name }), member('other', { memberNo: '', name: '' })]) {
    const tables = [{ tableName: 'A', seats: [seat(other)] }];
    assert.deepEqual(getUnassignedMembers(tables, [current]), [current]);
    assert.equal(addMemberToTable(tables, current, 'A')[0].seats.length, 2);
  }
});

test('only active unassigned members are offered; inactive additions and missing tables fail without mutation', () => {
  const existing = member('existing');
  const active = member('active');
  const absent = member('absent', { status: '休会' });
  const retired = member('retired', { status: '退会' });
  const tables = [{ tableName: 'A', seats: [seat(existing)] }];
  const before = JSON.stringify(tables);
  assert.deepEqual(getUnassignedMembers(tables, [existing, absent, active, retired]), [active]);
  for (const person of [absent, retired]) assert.throws(() => addMemberToTable(tables, person, 'A'), /在籍/);
  assert.throws(() => addMemberToTable(tables, active, 'missing'), /見つかりません/);
  assert.equal(JSON.stringify(tables), before);
});

test('guest addition trims fields, preserves all original seats and allows company to be empty', () => {
  const tables = [{ tableName: 'Aテーブル', seats: [seat(member('one'))] }, { tableName: 'Bテーブル', seats: [{ guestName: '旧ゲスト', isLeader: false }] }];
  const before = JSON.stringify(tables);
  const result = addGuestToTable(tables, '　新しいゲスト　', '  新会社  ', 'Aテーブル');
  assert.equal(JSON.stringify(tables), before);
  assert.notEqual(result, tables);
  assert.notEqual(result[0], tables[0]);
  assert.equal(result[0].seats[0], tables[0].seats[0]);
  assert.equal(result[1], tables[1]);
  assert.deepEqual(result[0].seats[1], { guestName: '新しいゲスト', guestCompany: '新会社', isLeader: false });
  assert.deepEqual(addGuestToTable(tables, '別ゲスト', ' ', 'Bテーブル')[1].seats[1], { guestName: '別ゲスト', guestCompany: '', isLeader: false });
});

test('guest validation rejects blanks, oversized fields, missing targets and duplicates across tables', () => {
  const tables = [{ tableName: 'Aテーブル', seats: [] }, { tableName: 'Bテーブル', seats: [{ guestName: '  同じ人 ', guestCompany: ' 会社 ', isLeader: false }, { guestName: '会社なし', isLeader: false }] }];
  const before = JSON.stringify(tables);
  assert.throws(() => addGuestToTable(tables, '　 ', '', 'Aテーブル'), /氏名/);
  assert.throws(() => addGuestToTable(tables, 'あ'.repeat(101), '', 'Aテーブル'), /100文字/);
  assert.throws(() => addGuestToTable(tables, '氏名', 'あ'.repeat(101), 'Aテーブル'), /100文字/);
  assert.throws(() => addGuestToTable(tables, '新規', '', 'missing'), /見つかりません/);
  assert.throws(() => addGuestToTable(tables, '同じ人', '会社', 'Aテーブル'), /既に/);
  assert.throws(() => addGuestToTable(tables, '会社なし', ' ', 'Aテーブル'), /既に/);
  assert.equal(addGuestToTable(tables, '同じ人', '別会社', 'Aテーブル')[0].seats.length, 1);
  assert.equal(addGuestToTable(tables, ` ${'あ'.repeat(100)} `, 'い'.repeat(100), 'Aテーブル')[0].seats.length, 1);
  assert.equal(JSON.stringify(tables), before);
});

test('automatic table names advance beyond the maximum recognized label, including Z and AA, without filling old gaps', () => {
  const tables = (...names) => names.map((tableName) => ({ tableName, seats: [] }));
  assert.equal(nextTableName([]), 'Aテーブル');
  assert.equal(nextTableName(tables('来賓席', 'aテーブル', 'A', 'Aテーブル予備')), 'Aテーブル');
  assert.equal(nextTableName(tables('Cテーブル', 'Aテーブル')), 'Dテーブル');
  assert.equal(nextTableName(tables('Zテーブル')), 'AAテーブル');
  assert.equal(nextTableName(tables('AAテーブル', 'Zテーブル', 'AAテーブル')), 'ABテーブル');
  assert.equal(nextTableName(tables('AZテーブル')), 'BAテーブル');
  assert.equal(nextTableName(tables('ZZテーブル')), 'AAAテーブル');
  assert.equal(nextTableName(tables(`${'Z'.repeat(20)}テーブル`)), `${'A'.repeat(21)}テーブル`, 'no numeric overflow for long labels');
});

test('adding empty tables preserves original references and appends distinct empty seat arrays', () => {
  const original = [{ tableName: 'Zテーブル', seats: [seat(member('one'))] }];
  const first = addEmptyTable(original);
  const second = addEmptyTable(first);
  assert.equal(original.length, 1);
  assert.equal(first.length, 2);
  assert.equal(second.length, 3);
  assert.equal(second[0], original[0]);
  assert.equal(second[1], first[1]);
  assert.deepEqual(first[1], { tableName: 'AAテーブル', seats: [] });
  assert.deepEqual(second[2], { tableName: 'ABテーブル', seats: [] });
  assert.notEqual(first[1].seats, second[2].seats);
  assert.deepEqual(addEmptyTable([]), [{ tableName: 'Aテーブル', seats: [] }]);
});
