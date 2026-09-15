const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(file) {
  const filename = path.join(__dirname, '..', file);
  const loaded = new Module(filename, module);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  return loaded.exports;
}
const { reconcileTableMembers } = load('lib/table-assignment/member-identity.ts');
const { members } = load('lib/data/mock.ts');
// Exact number/name sequence from git 9e8fc21:lib/data/mock.ts (32-member directory).
const legacyIdentity = [
  ['880','鈴木 優'], ['4769','渡辺 穣'], ['4797','浅里 綾夏'], ['4727','伊藤 瞳'],
  ['6789','中川 裕紀'], ['6808','井野 俊彦'], ['7846','亀嶋 有希'], ['4794','野口 貴之'],
  ['4881','向畑 太輔'], ['5235','菅咲 伎桂'], ['6313','渡辺 匠'], ['6716','髙橋 惺司'],
  ['7834','石神 亜矢子'], ['7871','岡本 英弥'], ['7855','木林 朋之'], ['7857','吉村 勇紀'],
  ['8678','三浦 昂大'], ['8676','三浦 涼華'], ['8791','浜田 翠'], ['8876','中川 麻衣'],
  ['8877','髙谷 理佳'], ['9187','野々村 亮'], ['9136','橋本 啓太'], ['9602','平澤 裕'],
  ['9563','大西 浩之'], ['9566','前阪 去枝'], ['9626','八木 悠磨'], ['9147','中本 怜男'],
  ['9714','坂本 彩'], ['9715','萩原 新'], ['9710','島田 尚幸'], ['9740','藤井 善貴']
];
const table = (people) => [{ tableName: '保存済み', seats: people.map((member) => ({ member, isLeader: false })) }];

test('historical 32-member directory maps to current identity despite 29 reused positional ids', () => {
  const old = legacyIdentity.map(([memberNo, name], i) => ({ id: `m-${i + 1}`, memberNo, name }));
  const input = table(old);
  const result = reconcileTableMembers(input, members);
  assert.equal(result.warning, '');
  const mapped = result.tables[0].seats.map((seat) => seat.member);
  assert.equal(mapped.filter((member, i) => member.id !== old[i].id).length, 29);
  for (const member of mapped) {
    const current = members.find((person) => person.id === member.id);
    assert.equal(current.name, member.name);
    assert.equal(current.memberNo, member.memberNo);
  }
  assert.equal(mapped[3].id, 'm-5');
  assert.equal(mapped[7].id, 'm-10');
  assert.equal(mapped[27].id, 'm-38');
  assert.equal(input[0].seats[3].member.id, 'm-4', 'historical evidence must remain unchanged');
});

test('duplicate member number alone never merges people; both identity fields must match uniquely', () => {
  const duplicateNumbers = members.filter((member) => member.memberNo === '9147');
  assert.equal(duplicateNumbers.length, 2);
  const result = reconcileTableMembers(table(duplicateNumbers.map((member) => ({ ...member, id: 'old-reused' }))), members);
  assert.deepEqual(result.tables[0].seats.map((seat) => seat.member.id), duplicateNumbers.map((member) => member.id));
  const ambiguous = reconcileTableMembers(table([duplicateNumbers[0]]), [...members, { ...duplicateNumbers[0], id: 'duplicate-same-name-and-number' }]);
  assert.match(ambiguous.warning, /一意に確認できません/);
  assert(!members.some((member) => member.id === ambiguous.tables[0].seats[0].member.id));
});

test('unknown, missing, or mismatched identity never trusts even a currently existing id', () => {
  const current = members[0];
  const sources = [{ ...current, name: '別人' }, { ...current, memberNo: '' }, { ...current, name: '' }, { ...current, memberNo: 'unknown-number' }];
  const result = reconcileTableMembers(table(sources), members);
  assert.match(result.warning, /同席確認は完全ではありません/);
  assert.match(result.warning, /確認が必要/);
  for (const seat of result.tables[0].seats) assert(!members.some((member) => member.id === seat.member.id));
  assert.deepEqual(result.tables[0].seats.map((seat) => seat.member.name), sources.map((member) => member.name));
});
