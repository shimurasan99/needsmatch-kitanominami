const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function fixture(fails = false) {
  const exports = {};
  let revoked = 0;
  let rendered = 0;
  class FakeImage {
    naturalWidth = 4000;
    naturalHeight = 3000;
    set src(value) { queueMicrotask(() => fails ? this.onerror() : this.onload()); }
  }
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({ fillRect() {}, drawImage() {} }),
    toDataURL() { rendered++; return 'data:image/jpeg;base64,' + 'a'.repeat(this.width > 800 ? 300000 : 100000); }
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/data/image-upload.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Image: FakeImage, URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => revoked++ },
    document: { createElement: () => canvas }, Promise, Error, Math
  });
  return { resize: exports.readResizedImage, canvas, get revoked() { return revoked; }, get rendered() { return rendered; } };
}

test('large images are bounded, preserve aspect ratio and release temporary URLs', async () => {
  const f = fixture();
  const result = await f.resize({ type: 'image/jpeg' });
  assert.ok(result.length <= 280000);
  assert.ok(f.canvas.width <= 1200);
  assert.equal(f.canvas.width / f.canvas.height, 4 / 3);
  assert.ok(f.rendered > 1);
  assert.equal(f.revoked, 1);
});

test('unsupported files and broken images fail clearly without leaking temporary URLs', async () => {
  const f = fixture(true);
  await assert.rejects(f.resize({ type: 'text/plain' }));
  assert.equal(f.revoked, 0);
  await assert.rejects(f.resize({ type: 'image/png' }));
  assert.equal(f.revoked, 1);
});
