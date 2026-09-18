// Local-only, in-memory PostgREST subset for manual browser tests. No real Supabase connection.
// Start: node tests/fixture-server.cjs
// In another terminal start Next with:
// NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:5440 SUPABASE_SERVICE_ROLE_KEY=fixture-only-key AUTH_SESSION_SECRET=fixture-only-session-secret npm run dev -- --port 3100
// All changes disappear when this process exits. Request logs contain no payloads/cookies.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { saveAttendance } = require('./attendance-rpc-fixture.cjs');
const { publishTableAssignment } = require('./publication-rpc-fixture.cjs');

const filename = path.join(__dirname, '../lib/data/mock.ts');
const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const loaded = new Module(filename, module);
loaded._compile(source.outputText, filename);
const mock = loaded.exports;
const stamp = '2026-09-01T00:00:00.000Z';
const seats = mock.members.slice(0, 25).map((member) => ({ member, isLeader: !!member.isTableLeader }));
const history = {
  'meeting-2026-07': { meetingId: 'meeting-2026-07', tables: Array.from({ length: 5 }, (_, column) => ({ tableName: `${String.fromCharCode(65 + column)}テーブル`, seats: Array.from({ length: 5 }, (_, row) => seats[row * 5 + column]) })), publishedAt: stamp },
  'meeting-2026-08': { meetingId: 'meeting-2026-08', tables: Array.from({ length: 5 }, (_, row) => ({ tableName: `${String.fromCharCode(65 + row)}テーブル`, seats: seats.slice(row * 5, row * 5 + 5) })), publishedAt: stamp }
};
const state = new Map([
  ['shared_site_state', [
    { state_key: 'members', payload: { additions: [], overrides: {}, deletions: [] }, updated_at: stamp },
    { state_key: 'table-assignments', payload: history, updated_at: stamp },
    { state_key: 'table-assignment-drafts', payload: {}, updated_at: stamp }
  ]],
  ['managed_meetings', mock.meetings.map((meeting) => ({ meeting_key: meeting.id, title: meeting.title, meeting_date: meeting.date, start_time: meeting.startTime, end_time: meeting.endTime, venue_name: meeting.venueName, venue_address: meeting.venueAddress, note: meeting.note, application_deadline: meeting.applicationDeadline, status: meeting.status, updated_at: stamp }))],
  ['attendance_responses', mock.meetings.flatMap((meeting) => mock.members.slice(0, 25).map((member) => ({ meeting_key: meeting.id, member_key: member.id, status: '参加', updated_at: stamp })))],
  ['attendance_snapshots', []]
]);
const requests = [];
const primaryKeys = { shared_site_state: ['state_key'], managed_meetings: ['meeting_key'], attendance_responses: ['meeting_key', 'member_key'], attendance_snapshots: ['meeting_key'] };
const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  if (req.method === 'OPTIONS') { res.end(); return; }
  const url = new URL(req.url, 'http://127.0.0.1:5440');
  if (url.pathname === '/__fixture/status') { res.end(JSON.stringify({ fixture: true, counts: Object.fromEntries([...state].map(([key, rows]) => [key, rows.length])), requests })); return; }
  const table = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/)?.[1];
  const reply = (status, body) => {
    requests.push({ method: req.method, table, status });
    if (requests.length > 500) requests.shift();
    console.log(`${req.method} ${table ?? 'unknown'} ${status}`);
    res.statusCode = status; res.end(body === undefined ? undefined : JSON.stringify(body));
  };
  if (req.method === 'POST' && url.pathname.startsWith('/rest/v1/rpc/')) {
    let raw = ''; for await (const chunk of req) raw += chunk;
    try {
      const body = JSON.parse(raw);
      if (url.pathname.endsWith('/save_attendance_atomic')) {
        const result = saveAttendance(state, body);
        reply(result.error ? 409 : 200, result.error ?? result.data);
        return;
      }
      if (url.pathname.endsWith('/publish_table_assignment')) {
        const result = publishTableAssignment(state, body);
        reply(result.error ? (result.error.code === 'P0001' ? 409 : 400) : 200, result.error ?? result.data);
        return;
      }
      reply(404, { message: 'Unknown fixture RPC' }); return;
    } catch (error) { reply(400, { message: error.message }); return; }
  }
  if (!table || !state.has(table)) { reply(404, { code: '42P01', message: 'Unknown fixture table' }); return; }
  try {
    const rows = state.get(table);
    const filters = [...url.searchParams].filter(([, value]) => value.startsWith('eq.') || value.startsWith('neq.'));
    const matches = (row) => filters.every(([column, expression]) => expression.startsWith('eq.') ? String(row[column]) === expression.slice(3) : String(row[column]) !== expression.slice(4));
    let result;
    if (req.method === 'GET') result = rows.filter(matches);
    else if (req.method === 'POST' || req.method === 'PATCH') {
      let raw = ''; for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw);
      if (req.method === 'PATCH') { result = rows.filter(matches); result.forEach((row) => Object.assign(row, body)); }
      else {
        const incoming = Array.isArray(body) ? body : [body];
        const keys = url.searchParams.get('on_conflict')?.split(',') ?? primaryKeys[table];
        const upsert = req.headers.prefer?.includes('resolution=merge-duplicates');
        if (!upsert && incoming.some((row) => rows.some((current) => keys.every((key) => current[key] === row[key])))) { reply(409, { code: '23505', message: 'Duplicate fixture key' }); return; }
        result = incoming.map((row) => {
          const existing = upsert && rows.find((current) => keys.every((key) => current[key] === row[key]));
          if (existing) { Object.assign(existing, row); return existing; }
          rows.push(row); return row;
        });
      }
      if (!req.headers.prefer?.includes('return=representation')) { reply(204); return; }
    } else { reply(405, { message: 'Fixture supports GET/POST/PATCH only' }); return; }
    const order = url.searchParams.get('order')?.split('.');
    if (order) result.sort((a, b) => String(a[order[0]]).localeCompare(String(b[order[0]])) * (order[1] === 'desc' ? -1 : 1));
    const selection = url.searchParams.get('select');
    if (selection && selection !== '*') result = result.map((row) => Object.fromEntries(selection.split(',').map((key) => [key, row[key]])));
    if (req.headers.accept?.includes('application/vnd.pgrst.object+json')) {
      if (result.length !== 1) { reply(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${result.length} rows` }); return; }
      reply(200, result[0]);
    } else reply(200, result);
  } catch (error) { reply(400, { message: error.message }); }
});
server.listen(5440, '127.0.0.1', () => console.log('Local fixture ready at http://127.0.0.1:5440; only in-memory test data.'));
