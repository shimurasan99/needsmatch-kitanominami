const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.join(__dirname, '..', file), m = new Module(filename, module);
  m.paths = module.paths;
  m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  return m.exports;
}
const operations = load('lib/admin/operations.ts');
const records = load('lib/admin/routine-record.ts', { '@/lib/admin/operations': operations });
const defaults = load('lib/admin/routine-defaults.ts', { '@/lib/admin/operations': operations });
const entry = load('lib/entry.ts');
function database() {
  const rows = new Map(); let failure = false;
  return { rows, fail: v => { failure = v; }, from(table) {
    let key, version, inserted, updated;
    const q = {
      select() { return q; }, eq(column, value) { if (column === 'state_key') key = value; else version = value; return q; },
      insert(row) { inserted = row; return q; }, update(row) { updated = row; return q; }, maybeSingle() { return q; },
      then(resolve, reject) { return Promise.resolve().then(() => {
        if (failure) return { data: null, error: { code: 'offline' } };
        if (table === 'managed_meetings') return { data: [], error: null };
        if (inserted) { if (rows.has(inserted.state_key)) return { data: null, error: { code: '23505' } }; rows.set(inserted.state_key, structuredClone(inserted)); return { data: inserted, error: null }; }
        const existing = rows.get(key);
        if (updated) { if (!existing || existing.updated_at !== version) return { data: null, error: null }; rows.set(key, structuredClone(updated)); return { data: updated, error: null }; }
        return { data: existing || null, error: null };
      }).then(resolve, reject); }
    }; return q;
  } };
}
const request = (method, body, headers = {}) => new Request('https://example.com/api/entry', { method, headers: { origin: 'https://example.com', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
test('routine template has 18 unfinished tasks; validation rejects malformed dates and duplicate IDs', () => {
  const data = defaults.defaultRoutine();
  assert.equal(data.tasks.length, 18);
  assert.ok(data.tasks.every(t => !t.done && !t.completedDate && !t.note));
  records.validateAdminRecord('routines-2026-11', data);
  data.tasks[0].dueDate = '2026-02-30';
  assert.throws(() => records.validateAdminRecord('routines-2026-11', data));
  data.tasks[0].dueDate = '';
  data.tasks.push(data.tasks[0]);
  assert.throws(() => records.validateAdminRecord('routines-2026-11', data), /重複/);
});
test('joining defaults only match unique documented names, not member numbers or guessed months', () => {
  const result = defaults.defaultJoining([{ id: 'a', name: '中本　怜男', memberNo: '9147' }, { id: 'b', name: '佐藤 正人', memberNo: '9147' }]);
  assert.equal(result.members.length, 1);
  assert.equal(result.members[0].memberId, 'a');
  assert.equal(result.members[0].joinedMonth, '2026-04');
  assert.equal(defaults.defaultJoining([{id: 'a', name: '中本怜男'}, {id:'b', name:'中本 怜男'}]).members.length, 0);
  assert.throws(() => records.validateAdminRecord('joining', { members: [{memberId:'a', joinedMonth:'2026-13', source:''}] }));
});
test('member-number reference order is numeric; duplicate numbers remain separate and blanks sort last', () => {
  const rows = [{memberNo:'100',name:'C'}, {memberNo:'20',name:'B'}, {memberNo:'20',name:'A'}, {memberNo:'',name:'D'}, {memberNo:'NM-３',name:'E'}].sort(records.compareMemberNumber);
  assert.deepEqual(rows.map(m=>m.name),['E','A','B','C','D']);
  assert.equal(rows.length,5);
});
test('admin records are private, scoped per month and protect cross-device stale writes', async () => {
  const db = database();
  const route = load('app/api/admin/records/[key]/route.ts', {
    '@/lib/auth': { isAdminRequest: async r => r.headers.get('role') === 'admin' },
    '@/lib/supabase/server': { createSupabaseServerClient: () => db }, '@/lib/admin/routine-defaults': defaults,
    '@/lib/admin/routine-record': records, '@/lib/admin/server-members': { readAdminMembers: async () => [] }
  });
  const context = key => ({ params: Promise.resolve({key}) }), nov = context('routines-2026-11');
  assert.equal((await route.GET(request('GET'), nov)).status, 401);
  assert.equal((await route.GET(request('GET', undefined, {role:'member'}), nov)).status, 401);
  assert.equal((await route.GET(request('GET', undefined, {role:'admin'}), context('secrets'))).status, 404);
  const r = await route.GET(request('GET', undefined, {role:'admin'}), nov), initial = await r.json();
  initial.data.tasks[0].done = true;
  const saved = await route.PUT(request('PUT', initial.data, {role:'admin','if-match':'new'}), nov);
  assert.equal(saved.status, 200);
  assert.equal((await route.PUT(request('PUT', initial.data, {role:'admin','if-match':'new'}), nov)).status, 409);
  const dec = await (await route.GET(request('GET', undefined, {role:'admin'}), context('routines-2026-12'))).json();
  assert.equal(dec.data.tasks[0].done, false);
  const secondDevice = await (await route.GET(request('GET', undefined, {role:'admin'}), nov)).json();
  assert.equal(secondDevice.data.tasks[0].done, true);
  db.fail(true);
  assert.equal((await route.PUT(request('PUT', initial.data, {role:'admin','if-match':secondDevice.version}), nov)).status, 503);
});
test('entry closes at JST start and deadline, and requires consent/referrer/valid contacts', () => {
  const m = { status:'確定', date:'2026-11-20', startTime:'15:00', applicationDeadline:'2026-11-20' };
  assert.equal(entry.entryOpen(m, new Date('2026-11-20T05:59:59Z')), true);
  assert.equal(entry.entryOpen(m, new Date('2026-11-20T06:00:00Z')), false);
  assert.equal(entry.entryOpen({...m, applicationDeadline:'2026-11-19'}, new Date('2026-11-19T15:01:00Z')), false);
  assert.equal(entry.entryOpen({...m, status:'下書き'}, new Date('2026-10-20')), false);
  assert.throws(() => entry.validateEntry({...input(), consent:false}), /同意/);
  assert.throws(() => entry.validateEntry({...input(), referrer:''}));
  assert.throws(() => entry.validateEntry({...input(), email:'nope'}));
});
function input() { return { meetingId:'test-meeting', meetingDate:'2099-11-20', name:'テスト 太郎', kana:'テスト タロウ', email:'test@example.com', phone:'000-0000-0000', participantType:'ゲスト', branchName:'', memberNo:'', company:'テスト屋号', industry:'テスト業', industryDetail:'説明', desiredPartners:'希望', referrer:'紹介者', socialAttendance:'参加', note:'テストのみ', consent:true }; }
process.env.AUTH_SESSION_SECRET = 'test-only-entry-secret';
function server(db) { return load('lib/entry-server.ts', { '@/lib/supabase/server': {}, '@/lib/data/mock': { meetings:[{id:'test-meeting', date:'2099-11-20', title:'テスト', status:'確定', startTime:'15:00', applicationDeadline:'2099-11-19'}] }, '@/lib/data/meeting-record': { meetingFromRow:r=>r }, '@/lib/entry': entry }); }
function token(s) { const old = Date.now; Date.now = () => old() - 2000; const token = s.issueEntryToken(); Date.now = old; return token; }
test('HP entry persists privately, shows success only after insert, and retry cannot overwrite reviewed response', async () => {
  const db = database(), s = server(db);
  const route = load('app/api/entry/route.ts', { '@/lib/supabase/server': {createSupabaseServerClient:()=>db}, '@/lib/entry':entry, '@/lib/entry-server':s });
  const body = {...input(), token:token(s)};
  assert.equal((await route.POST(request('POST', body, {origin:'https://evil.example'}))).status,403);
  assert.equal((await route.POST(request('POST', {...body, website:'bot'}))).status,400);
  const saved = await route.POST(request('POST', body));
  assert.equal(saved.status,201);
  const result = await saved.json();
  assert.equal(result.accepted,true);
  assert.equal(JSON.stringify(result).includes('test@example.com'),false);
  const key = [...db.rows.keys()].find(k=>k.startsWith('admin-form:'));
  const record = db.rows.get(key).payload;
  assert.equal(record.kana,'テスト タロウ'); assert.equal(record.socialAttendance,'参加'); assert.equal(record.source,'hp');
  record.applied = {memberId:'m1'};
  const again = await route.POST(request('POST', body));
  assert.equal((await again.json()).duplicate,true);
  assert.equal(db.rows.get(key).payload.applied.memberId,'m1');
  assert.equal((await route.POST(request('POST', {...body, name:'別人'}))).status,409);
  assert.equal((await route.POST(request('POST', {...body, token:token(s), meetingId:'draft'}))).status,400);
  assert.equal((await route.POST(request('POST', {...body, token:token(s), meetingDate:'2099-11-19'}))).status,400);
  db.fail(true);
  assert.equal((await route.POST(request('POST', {...body, token:token(s)}))).status,503);
});
test('entry throttling is durable and atomic across simultaneous instances; unsigned tokens fail', async () => {
  const db = database(), a = server(db), b = server(db);
  assert.equal(a.verifyEntryToken('not-signed'),false);
  const t = token(a); assert.equal(b.verifyEntryToken(t),true); assert.equal(b.verifyEntryToken(t.slice(0,-1)+'x'),false);
  const results = await Promise.all(Array.from({length:30},(_,i)=>(i%2?a:b).allowEntry(db,'same-ip')));
  assert.ok(results.filter(Boolean).length <= 10);
  for(let i=0;i<10;i++) await a.allowEntry(db,'same-ip');
  assert.equal(await b.allowEntry(db,'same-ip'),false);
});
test('1on1 upload detects content rather than trusting extension and rejects executable/HTML content', () => {
  const files = load('lib/admin/one-on-one.ts');
  assert.equal(files.oneOnOneType(Buffer.from('%PDF-1.4 test')).mime,'application/pdf');
  assert.equal(files.oneOnOneType(Buffer.from([255,216,255,0])).extension,'jpg');
  assert.throws(()=>files.oneOnOneType(Buffer.from('<html>fake.pdf</html>')));
  assert.equal(files.MAX_ONE_ON_ONE_SIZE,3*1024*1024);
});
test('1on1 files require admin for list/upload/download, use private bucket and preserve previous versions', async () => {
  const objects = new Map(); let bucket = null, createdOptions, signedOptions;
  const db = { storage: {
    getBucket: async () => bucket ? {data:bucket,error:null} : {data:null,error:{status:404,message:'not found'}},
    createBucket: async (name, options) => { createdOptions=options; bucket={public:options.public}; return {data:bucket,error:null}; },
    from: () => ({
      upload: async (key, bytes, options) => { assert.equal(options.upsert,false); objects.set(key,bytes); return {error:null}; },
      list: async folder => ({ data:[...objects].filter(([key])=>key.startsWith(folder+'/')).map(([key,bytes])=>({id:key,name:key.split('/').pop(),created_at:new Date().toISOString(),metadata:{size:bytes.length}})),error:null }),
      createSignedUrl: async (key, seconds, options) => { signedOptions={key,seconds,options}; return {data:{signedUrl:'https://storage.example/signed-file'},error:null}; }
    })
  }};
  const route = load('app/api/admin/one-on-one/[id]/route.ts', {
    '@/lib/auth': {isAdminRequest:async r=>r.headers.get('role')==='admin'},
    '@/lib/supabase/server':{createSupabaseServerClient:()=>db},
    '@/lib/admin/server-members':{readAdminMembers:async()=>[{id:'m1'}]},
    '@/lib/admin/one-on-one':load('lib/admin/one-on-one.ts')
  });
  const ctx={params:Promise.resolve({id:'m1'})};
  const upload = (role='admin', content='%PDF-1.4 safe test') => {
    const form=new FormData(); form.set('file',new File([content],'sheet.pdf',{type:'application/pdf'}));
    return new Request('https://example.com/api/admin/one-on-one/m1',{method:'POST',headers:{role,origin:'https://example.com'},body:form});
  };
  assert.equal((await route.GET(request('GET'),ctx)).status,401);
  assert.equal((await route.POST(upload('member'),ctx)).status,401);
  assert.equal((await route.POST(upload(),ctx)).status,201);
  assert.equal(createdOptions.public,false);
  assert.equal((await route.POST(upload(),ctx)).status,201);
  assert.equal(objects.size,2);
  assert.equal((await route.POST(upload('admin','<html>not PDF</html>'),ctx)).status,503);
  const list=await (await route.GET(request('GET',undefined,{role:'admin'}),ctx)).json();
  assert.equal(list.files.length,2);
  const download=new Request('https://example.com/api/admin/one-on-one/m1?file='+list.files[0].name,{headers:{role:'admin'}});
  assert.equal((await route.GET(download,ctx)).status,302);
  assert.equal(signedOptions.seconds,60);
  assert.ok(signedOptions.options.download);
  const traversal=new Request('https://example.com/api/admin/one-on-one/m1?file=../other.pdf',{headers:{role:'admin'}});
  assert.equal((await route.GET(traversal,ctx)).status,400);
  bucket.public=true;
  assert.equal((await route.POST(upload(),ctx)).status,503);
  assert.equal((await route.GET(download,ctx)).status,503);
  assert.equal(objects.size,2);
});
