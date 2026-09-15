const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.join(__dirname, '../lib/data/csv-export.ts');
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { csvCell } = loaded.exports;

test('spreadsheet formula starters, whitespace/control prefixes and Japanese fullwidth starters receive a text prefix', () => {
  for (const input of ['=1+2', '+123', '-123', '@SUM(A1)', '＝1+2', '＋1', '－1', '＠SUM(A1)', '  =1', '\u3000＋1', '\t=1', '\r=1', '\n=1', '\u0000=1', '\tplain', '\nplain']) {
    assert.equal(csvCell(input), `"\t${input}"`, JSON.stringify(input));
  }
});

test('quoted delimiters and embedded quotes stay inside a single CSV field', () => {
  assert.equal(csvCell('=1+2";,=3'), '"\t=1+2"";,=3"');
  assert.equal(csvCell('Company, "A"\nBranch'), '"Company, ""A""\nBranch"');
});

test('ordinary names, numbers, URLs and nonleading formula characters are unchanged', () => {
  for (const input of ['', '田中 太郎', '001', '1000', ' https://example.com', 'A+B', 'user@example.com']) {
    assert.equal(csvCell(input), `"${input}"`);
  }
});
