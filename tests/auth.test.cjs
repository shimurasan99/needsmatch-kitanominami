const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.join(__dirname, '../lib/auth.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
const loaded = new Module(filename, module);
loaded._compile(compiled.outputText, filename);
const auth = loaded.exports;
if (!globalThis.crypto) globalThis.crypto = require('node:crypto').webcrypto;
async function run() {
  const oldSecret = process.env.AUTH_SESSION_SECRET;
  const oldServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const realNow = Date.now;
  try {
    process.env.AUTH_SESSION_SECRET = 'local-auth-regression-secret-only';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const admin = await auth.createSessionToken('admin');
    const member = await auth.createSessionToken('member');
    assert.equal(await auth.verifySessionToken(admin, 'admin'), true);
    assert.equal(await auth.verifySessionToken(admin, 'member'), false);
    assert.equal(await auth.verifySessionToken(member, 'admin'), false);
    assert.equal(await auth.verifySessionToken('ok', 'admin'), false);
    assert.equal(await auth.verifySessionToken(`${admin}.extra`, 'admin'), false);
    const [payload, signature] = admin.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    claims.role = 'member';
    assert.equal(await auth.verifySessionToken(`${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${signature}`, 'member'), false);
    const adminRequest = new Request('http://localhost', { headers: { cookie: `${auth.ADMIN_AUTH_COOKIE}=${admin}` } });
    assert.equal(await auth.isAdminRequest(adminRequest), true);
    assert.equal(await auth.isSignedInRequest(adminRequest), true);
    const memberRequest = new Request('http://localhost', { headers: { cookie: `${auth.MEMBER_AUTH_COOKIE}=${member}` } });
    assert.equal(await auth.isAdminRequest(memberRequest), false);
    assert.equal(await auth.isSignedInRequest(memberRequest), true);
    assert.equal(await auth.isAdminRequest(new Request('http://localhost', { headers: { cookie: `${auth.ADMIN_AUTH_COOKIE}=%zz` } })), false);
    Date.now = () => realNow() - 13 * 60 * 60 * 1000;
    const expired = await auth.createSessionToken('admin');
    Date.now = realNow;
    assert.equal(await auth.verifySessionToken(expired, 'admin'), false);
    process.env.AUTH_SESSION_SECRET = 'rotated-secret';
    assert.equal(await auth.verifySessionToken(admin, 'admin'), false);
    delete process.env.AUTH_SESSION_SECRET;
    assert.equal(await auth.verifySessionToken(admin, 'admin'), false);
    await assert.rejects(auth.createSessionToken('admin'));
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-side-fallback-secret';
    const fallback = await auth.createSessionToken('admin');
    assert.equal(await auth.verifySessionToken(fallback, 'admin'), true);
    console.log('Signed session regression tests passed.');
  } finally {
    Date.now = realNow;
    if (oldSecret === undefined) delete process.env.AUTH_SESSION_SECRET; else process.env.AUTH_SESSION_SECRET = oldSecret;
    if (oldServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldServiceKey;
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
