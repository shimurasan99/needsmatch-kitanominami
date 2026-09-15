const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');

function fixture() {
  let state = null;
  let saves = 0;
  const api = {
    fetchSharedState: async () => structuredClone(state),
    updateSharedState: async (_key, update) => {
      const next = update(structuredClone(state));
      saves++;
      state = structuredClone(next);
      return next;
    }
  };
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/data/member-overrides.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, {
    exports, require: () => api, Event, Set,
    window: {
      localStorage: { setItem() { throw new Error('QuotaExceeded'); }, getItem() { return JSON.stringify([{ id: 'stale', memberNo: '99' }]); } },
      dispatchEvent() {}
    }
  });
  return { members: exports, get state() { return state; }, get saves() { return saves; } };
}

test('server reads and saves survive a full browser cache without reviving stale local records', async () => {
  const f = fixture();
  const base = [{ id: 'base', memberNo: '1', name: 'Base' }];
  assert.equal((await f.members.fetchManagedMembers(base)).length, 1);
  const saved = await f.members.saveMemberAddition(base, { id: 'a', memberNo: ' 2 ', name: ' Alice ' });
  assert.equal(saved.length, 2);
  assert.equal(saved[1].name, 'Alice');
  assert.equal((await f.members.fetchManagedMembers(base))[1].memberNo, '2');
});

test('CSV batch validation prevents partial writes and rejects blank fields', async () => {
  const f = fixture();
  const base = [{ id: 'base', memberNo: '1', name: 'Base' }];
  await assert.rejects(f.members.saveMemberAdditions(base, [{ id: 'a', memberNo: '2', name: 'A' }, { id: 'b', memberNo: '1', name: 'B' }]));
  await assert.rejects(f.members.saveMemberAddition(base, { id: 'a', memberNo: '2', name: '   ' }));
  await assert.rejects(f.members.saveMemberAdditions(base, [{ id: 'a', memberNo: '2', name: 'A' }, { id: 'b', memberNo: '2', name: 'B' }]));
  assert.equal(f.saves, 0);
});

test('independent edits survive; deleted members cannot be revived and their number can be reused', async () => {
  const f = fixture();
  await f.members.saveMemberAddition([], { id: 'a', memberNo: '2', name: 'A' });
  await f.members.saveMemberOverride('a', { industry: 'New' });
  await f.members.saveMemberOverride('a', { websiteUrl: 'https://example.org' });
  assert.equal(f.state.overrides.a.industry, 'New');
  await f.members.deleteSharedMember('a');
  await assert.rejects(f.members.saveMemberOverride('a', { industry: 'Revival' }));
  assert.equal((await f.members.fetchManagedMembers([])).length, 0);
  await f.members.saveMemberAddition([], { id: 'replacement', memberNo: '2', name: 'Replacement' });
  assert.equal(f.state.additions[0].id, 'replacement');
});
