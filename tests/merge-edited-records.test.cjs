const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const loaded = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/data/merge-edited-records.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: loaded, Map, JSON, Object });
const merge = loaded.mergeEditedRecords;
const base = [{ id: 'a', name: 'A', url: 'old' }];

test('merges different field edits and preserves another operators new records', () => {
  const result = merge([{ id: 'a', name: 'Admin B', url: 'old' }, { id: 'b', name: 'B', url: 'b' }], base, [{ id: 'a', name: 'A', url: 'new' }]);
  assert.equal(result[0].name, 'Admin B');
  assert.equal(result[0].url, 'new');
  assert.equal(result[1].id, 'b');
});

test('conflicting field edits and deleting a concurrently edited record are rejected', () => {
  const current = [{ id: 'a', name: 'Other', url: 'old' }];
  assert.throws(() => merge(current, base, [{ id: 'a', name: 'Mine', url: 'old' }]));
  assert.throws(() => merge(current, base, []));
});

test('deleted records stay deleted; edits to a deleted record conflict', () => {
  assert.equal(merge([], base, base).length, 0);
  assert.throws(() => merge([], base, [{ id: 'a', name: 'Edited', url: 'old' }]));
  assert.equal(merge(base, base, []).length, 0);
});
