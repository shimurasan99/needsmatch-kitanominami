const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.join(__dirname, '../lib/table-assignment/generator.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
const loaded = new Module(filename, module);
loaded._compile(compiled.outputText, filename);
const { generateTableAssignment } = loaded.exports;
const members = Array.from({ length: 25 }, (_, i) => ({ id: `m${i}`, name: `Member ${i}`, majorIndustry: 'その他', position: '一般会員', isTableLeader: i < 5 }));
const participants = members.map((member, i) => ({ id: `p${i}`, meetingId: 'current', memberId: member.id, status: '参加' }));
const table = (indices) => ({ tableName: 'Past', seats: indices.map((i) => ({ member: members[i], isLeader: members[i].isTableLeader })) });
const previous = Array.from({ length: 5 }, (_, r) => table(Array.from({ length: 5 }, (_, c) => r * 5 + c)));
const beforePrevious = Array.from({ length: 5 }, (_, c) => table(Array.from({ length: 5 }, (_, r) => r * 5 + c)));
const history = [...previous, ...beforePrevious];
const pair = (a, b) => JSON.stringify([a, b].sort());
const pairs = (tables) => tables.flatMap((t) => t.seats.flatMap((a, i) => t.seats.slice(i + 1).map((b) => pair(a.member.id, b.member.id))));
const prohibited = new Set(pairs(history));
// Rows and columns from two separate meetings: a third set of diagonals is feasible.
for (const attempts of [1, 20, 600]) {
  const result = generateTableAssignment(participants, members, history, attempts, 5);
  assert.equal(result.repeatedPairs, 0);
  assert.equal(pairs(result.tables).filter((key) => prohibited.has(key)).length, 0);
  assert.deepEqual(result.tables.map((t) => t.seats.length), [5, 5, 5, 5, 5]);
  assert.equal(new Set(result.tables.flatMap((t) => t.seats.map((s) => s.member.id))).size, 25);
}
// A single table of four people necessarily repeats six historical pairs.
const impossible = generateTableAssignment(participants.slice(0, 4), members, [table([0, 1, 2, 3])], 1, 4);
assert.equal(impossible.repeatedPairs, 6);
assert(impossible.warnings.some((warning) => warning.includes('ゼロにできません')));
assert.equal(impossible.warnings.filter((warning) => warning.includes('にも同席')).length, 6);
// No phantom table; invalid attempt/size inputs still give a valid result.
assert.deepEqual(generateTableAssignment([], members).tables, []);
const balanced = generateTableAssignment([...participants.slice(0, 11), participants[0]], members, [], 0, NaN);
assert.deepEqual(balanced.tables.map((t) => t.seats.length), [4, 4, 3]);
assert.equal(balanced.tables.flatMap((t) => t.seats).length, 11);
const withGuest = generateTableAssignment([...participants.slice(0, 3), { id: 'guest', status: 'ゲスト', guestName: 'Guest' }, { id: 'absent', memberId: 'm4', status: '欠席' }], members);
assert.equal(withGuest.tables.flatMap((t) => t.seats).length, 4);
assert.equal(withGuest.tables.flatMap((t) => t.seats).filter((s) => s.guestName === 'Guest').length, 1);
console.log('Table assignment regression tests passed.');
