const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.join(__dirname, '../lib/table-assignment/manual-addition.ts');
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { getUnassignedMembers, addMemberToTable } = loaded.exports;
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
