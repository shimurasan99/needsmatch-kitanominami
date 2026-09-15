const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.join(__dirname, '../lib/data/participant-storage.ts');
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { storedParticipantsValueToParticipants: convert, countMeetingAttendees } = loaded.exports;
const members = Array.from({ length: 27 }, (_, i) => ({ id: `member-${i}` }));
const fixtures = members.map(member => ({ id: member.id, memberId: member.id, meetingId: 'old', status: '参加' }));
fixtures.push({ id: 'mock-guest', meetingId: 'old', guestName: 'Mock Guest', status: 'ゲスト' });
fixtures.push({ id: 'same-meeting-guest', meetingId: 'current', guestName: 'Mock Current Guest', status: 'ゲスト' });

test('25 canonical attendees stay 25 despite initial mock attendees and omitted guests', () => {
  const stored = { statuses: Object.fromEntries(members.slice(0, 25).map(member => [member.id, '参加'])) };
  const participants = convert('current', members, fixtures, stored);
  assert.equal(participants.filter(p => p.status === '参加' || p.status === 'ゲスト').length, 25);
  assert.equal(participants.filter(p => p.status === '未定').length, 2);
  assert.equal(participants.some(p => p.guestName), false);
  global.window = { localStorage: { getItem: () => JSON.stringify(stored) } };
  assert.equal(countMeetingAttendees('current', members, fixtures), 25);
  delete global.window;
});

test('empty server state cannot resurrect any initial member or guest attendance', () => {
  for (const stored of [{}, { statuses: {}, guests: [] }]) {
    const participants = convert('current', members, fixtures, stored);
    assert.equal(participants.length, members.length);
    assert.ok(participants.every(p => p.status === '未定'));
  }
});

test('legacy fallback is scoped to the requested meeting; canonical cancellations and guests are preserved', () => {
  assert.deepEqual(convert('current', members, fixtures, null), [fixtures.at(-1)]);
  const participants = convert('current', members, fixtures, { statuses: { 'member-0': 'キャンセル' }, guests: [{ id: 'real', name: 'Real Guest', company: 'Company' }] });
  assert.equal(participants[0].status, '欠席');
  assert.equal(participants.at(-1).guestName, 'Real Guest');
  assert.equal(participants.filter(p => p.status === 'ゲスト').length, 1);
});
