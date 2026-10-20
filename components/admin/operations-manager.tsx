"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { COURSES, TRAINING_STATUSES, emptyCourses, emptyOperations, matchMember, validateOperations, type MemberNote, type Operations, type Seminar, type Training, type TrainingStatus } from "@/lib/admin/operations";
import type { FormResponse } from "@/lib/admin/form-response";
import { fetchManagedMembers } from "@/lib/data/member-overrides";
import { fetchMeetings } from "@/lib/data/meeting-storage";
import { fetchStoredParticipants, type StoredParticipants } from "@/lib/data/participant-storage";
import { csvCell } from "@/lib/data/csv-export";
import type { Meeting, Member } from "@/types/domain";

const input = "focus-ring w-full min-w-0 rounded border border-slate-300 bg-white px-3 py-2 text-sm";
const button = "focus-ring rounded border border-slate-300 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50";
const tabs = ["参加者名簿", "会員一覧（文字のみ）", "受講状況", "10分セミナー担当", "参加申込受付"] as const;
type Tab = typeof tabs[number];
const newId = () => crypto.randomUUID();

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "通信に失敗しました。入力内容は保持しています。");
  return body;
}
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement("a");
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportRows(name: string, rows: string[][]) { download(name, "\uFEFF" + rows.map(r => r.map(csvCell).join(",")).join("\r\n"), "text/csv;charset=utf-8"); }
async function readResponses(): Promise<FormResponse[]> {
  let all: FormResponse[] = [];
  for (let page = 0; page < 100; page++) {
    const result = await jsonRequest(`/api/admin/form-responses?page=${page}`); all = all.concat(result.responses);
    if (!result.hasMore) return all;
  }
  throw new Error("回答が多いため全件を取得できませんでした。運営にお問い合わせください。");
}

export function OperationsManager({ initialMembers, initialMeetings }: { initialMembers: Member[]; initialMeetings: Meeting[] }) {
  const [tab, setTab] = useState<Tab>("参加者名簿");
  const [members, setMembers] = useState<Member[]>([]), [meetings, setMeetings] = useState<Meeting[]>([]);
  const [data, setData] = useState<Operations>(emptyOperations), [version, setVersion] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0), [search, setSearch] = useState("");
  const [editNote, setEditNote] = useState(""), [editTraining, setEditTraining] = useState(""), [editSeminar, setEditSeminar] = useState("");
  const [meetingId, setMeetingId] = useState(""), [attendance, setAttendance] = useState<StoredParticipants | null>(null), [attendanceLoading, setAttendanceLoading] = useState(false);
  const [responses, setResponses] = useState<FormResponse[]>([]), [responsesLoaded, setResponsesLoaded] = useState(false);
  const [integration, setIntegration] = useState<boolean | null>(null), [script, setScript] = useState("");
  const lock = useRef(false);

  useEffect(() => {
    let active = true; setLoaded(false); setError("");
    Promise.all([fetchManagedMembers(initialMembers), fetchMeetings(initialMeetings), jsonRequest("/api/admin/operations"), readResponses()]).then(([m, meetings, result, forms]) => {
      if (!active) return;
      setMembers(m); setMeetings(meetings); setData(validateOperations(result.data)); setVersion(result.version); setLoaded(true); setDirty(false);
      setResponses(forms); setResponsesLoaded(true);
      const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
      setMeetingId(current => current || meetings.find((v: Meeting) => v.date >= today && v.status === "確定")?.id || meetings.at(-1)?.id || "");
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "読み込めませんでした。"); });
    return () => { active = false; };
  }, [initialMembers, initialMeetings, revision]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: MouseEvent) => {
      const link = (event.target as Element)?.closest?.("a[href]");
      if (link && !window.confirm("未保存の変更があります。このページを離れますか？")) { event.preventDefault(); event.stopPropagation(); }
    };
    document.addEventListener("click", warn, true); return () => document.removeEventListener("click", warn, true);
  }, [dirty]);
  useEffect(() => {
    if (!meetingId) return;
    let active = true; setAttendance(null); setAttendanceLoading(true);
    fetchStoredParticipants(meetingId).then(value => { if (active) setAttendance(value); }).catch(cause => { if (active) setError(cause.message); }).finally(() => { if (active) setAttendanceLoading(false); });
    return () => { active = false; };
  }, [meetingId, revision]);

  function change(update: (state: Operations) => Operations) { setData(update); setDirty(true); setMessage(""); }
  async function action(work: () => Promise<void>) {
    if (lock.current) return; lock.current = true; setBusy(true); setError(""); setMessage("");
    try { await work(); } catch (cause) { setError(cause instanceof Error ? cause.message : "処理に失敗しました。"); }
    finally { lock.current = false; setBusy(false); }
  }
  async function save() { await action(async () => {
    const result = await jsonRequest("/api/admin/operations", { method: "PUT", headers: { "Content-Type": "application/json", "If-Match": version ?? "new" }, body: JSON.stringify(validateOperations(data)) });
    setData(validateOperations(result.data)); setVersion(result.version); setDirty(false); setMessage("保存しました。ほかの運営者のPC・スマホからも確認できます。");
  }); }
  function reload() { if (dirty && !window.confirm("未保存の入力を破棄して最新情報を読み込みますか？")) return; setRevision(n => n + 1); setMessage(""); }
  async function loadResponses() {
    setResponses(await readResponses()); setResponsesLoaded(true);
  }
  function showTab(next: Tab) {
    setTab(next); setSearch("");
    if (next === "参加申込受付") void action(async () => {
      await loadResponses(); const result = await jsonRequest("/api/admin/form-integration"); setIntegration(result.configured);
    });
  }
  async function importFile(file?: File) {
    if (!file) return;
    await action(async () => {
      if (file.size > 2_000_000) throw new Error("ファイルが大きすぎます。");
      const incoming = validateOperations(JSON.parse(await file.text()));
      const count = incoming.memberNotes.length + incoming.training.length + incoming.seminars.length;
      if (!window.confirm(`${count}件の移行データを読み込みます。既存の運営データがある場合は取り込めません。続けますか？`)) return;
      if (data.memberNotes.length || data.training.length || data.seminars.length) throw new Error("既存データの上書きを防ぐため、初回取込のみ対応しています。");
      change(() => incoming); setMessage("移行データを読み込みました。内容を確認して「変更を保存」を押してください。");
    });
  }
  const noteFor = (m: Member) => data.memberNotes.find(n => n.memberId === m.id);
  function openNote(m?: Member) {
    const existing = m && noteFor(m);
    if (existing) { setEditNote(existing.id); return; }
    const n: MemberNote = { id: newId(), memberId: m?.id ?? "", memberNo: m?.memberNo ?? "", name: m?.name ?? "新しい外部会員", company: m?.company ?? "", industry: m?.industry ?? "", attribute: "", industryDetail: "", desiredPartners: "", oneOnOneUrl: "", facebookUrl: "", note: "" };
    change(d => ({ ...d, memberNotes: [...d.memberNotes, n] })); setEditNote(n.id);
  }
  function updateNote(values: Partial<MemberNote>) { change(d => ({ ...d, memberNotes: d.memberNotes.map(n => n.id === editNote ? { ...n, ...values } : n) })); }
  function updateTraining(values: Partial<Training>) { change(d => ({ ...d, training: d.training.map(n => n.id === editTraining ? { ...n, ...values } : n) })); }
  function updateSeminar(values: Partial<Seminar>) { change(d => ({ ...d, seminars: d.seminars.map(n => n.id === editSeminar ? { ...n, ...values } : n) })); }
  const note = data.memberNotes.find(n => n.id === editNote), training = data.training.find(n => n.id === editTraining), seminar = data.seminars.find(n => n.id === editSeminar);
  const matches = (...values: string[]) => values.join(" ").toLocaleLowerCase().includes(search.toLocaleLowerCase());
  const memberRows = members.filter(m => matches(m.name, m.memberNo, m.company, m.industry));
  const guests = attendance?.guests?.filter(g => g.status !== "欠席") ?? [];
  const attendees = members.filter(m => attendance?.statuses?.[m.id] === "参加");
  const rosterRows = [...attendees.map(m => { const n = noteFor(m); return ["会員", m.name, m.company, m.industry, n?.industryDetail || "", n?.desiredPartners || "", n?.oneOnOneUrl || "", m.facebookUrl]; }), ...guests.map(g => { const r = responses.find(r => r.applied?.guestId === g.id && r.applied.meetingId === meetingId); return [g.type, g.name, g.company, g.industry, r?.industryDetail || "", r?.desiredPartners || "", r?.oneOnOneUrl || "", r?.facebookUrl || ""]; })];

  return <div className="space-y-5">
    <p className="text-sm text-slate-600">この管理画面と研修・担当予定のデータは運営専用です。更新はHPで行い、元のスプレッドシートは保管用に残します。</p>
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="運営管理の項目">{tabs.map(name => <button key={name} role="tab" aria-selected={tab === name} disabled={busy} className={`${button} ${tab === name ? "border-forest text-forest" : ""}`} onClick={() => showTab(name)}>{name}</button>)}</div>
    <div className="flex flex-wrap gap-3"><button className={button} disabled={busy} onClick={reload}>最新情報を読み込む</button><button className={`${button.replace("bg-white", "bg-forest")} text-white`} disabled={!loaded || busy || !dirty} onClick={save}>{busy ? "処理中…" : "変更を保存"}</button>{dirty && <span className="self-center text-sm font-bold text-amber-700">未保存の変更があります</span>}</div>
    {error && <p role="alert" className="rounded bg-red-50 p-4 text-red-700">{error}</p>}
    {message && <p role="status" className="rounded bg-green-50 p-4 text-forest">{message}</p>}
    {!loaded && !error && <p role="status">最新の情報を読み込んでいます…</p>}
    <fieldset disabled={!loaded || busy} className="min-w-0 space-y-5">
      {tab === "参加者名簿" && <>
        <label className="block max-w-xl">対象の月例会<select className={input} value={meetingId} onChange={e => setMeetingId(e.target.value)}><option value="">選択してください</option>{meetings.map(m => <option key={m.id} value={m.id}>{m.date} {m.title}</option>)}</select></label>
        <p className="text-sm">HPに保存されている「参加」の会員と、欠席ではないゲストを表示します。変更は参加者管理で行います。</p>
        {meetingId && <Link className="inline-block font-bold text-forest underline" href={`/admin/meetings/${encodeURIComponent(meetingId)}/participants`}>出欠の変更・参加者の追加へ</Link>}
        {attendanceLoading ? <p role="status">出欠を読み込み中…</p> : attendance && <>
          <p className="font-bold">参加者 {rosterRows.length}名（会員 {attendees.length}名・ゲスト等 {guests.length}名）</p>
          <button className={button} onClick={() => exportRows(`参加者名簿-${meetingId}.csv`, [["区分", "氏名", "会社名／屋号", "業種", "業種詳細", "希望提携先", "1on1シート", "Facebook"], ...rosterRows])}>参加者名簿をCSV保存</button>
          <Table headers={["区分", "氏名", "会社名／屋号", "業種", "業種詳細", "希望提携先"]} rows={rosterRows.map(r => r.slice(0, 6))} />
          {!rosterRows.length && <p>現在、参加予定の方はいません。</p>}
        </>}
      </>}
      {tab === "会員一覧（文字のみ）" && <>
        <Search value={search} onChange={setSearch} />
        <div className="flex flex-wrap gap-3"><button className={button} onClick={() => exportRows("会員一覧.csv", [["NM-ID", "氏名", "会社名／屋号", "業種", "役職", "在籍状態", "業種詳細", "希望提携先", "運営メモ"], ...memberRows.map(m => [m.memberNo, m.name, m.company, m.industry, m.position, m.status, noteFor(m)?.industryDetail || "", noteFor(m)?.desiredPartners || "", noteFor(m)?.note || ""])])}>会員一覧をCSV保存</button><button className={button} onClick={() => openNote()}>外部会員・参照名簿を追加</button><Link href="/admin/members" className={`${button} inline-block`}>新規会員登録・基本情報の管理</Link></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["NM-ID", "氏名", "会社・業種", "役職・在籍", "操作"].map(h => <th key={h} className="whitespace-nowrap border-b p-3">{h}</th>)}</tr></thead><tbody>{memberRows.map(m => <tr key={m.id} className="border-b bg-white"><td className="p-3">{m.memberNo}</td><td className="whitespace-nowrap p-3">{m.name}</td><td className="p-3">{m.company}<br />{m.industry}</td><td className="p-3">{m.position}<br />{m.status}</td><td className="p-3"><button className={button} onClick={() => openNote(m)}>運営情報</button><Link className="ml-2 underline" href={`/admin/members/${encodeURIComponent(m.id)}`}>基本情報編集</Link></td></tr>)}</tbody></table></div>
        <h2 className="text-xl font-bold">外部会員・照合待ちの名簿</h2><p className="text-sm">HP会員と未連携の移行元データです。氏名・番号を確認して紐付けできます。自動で公開会員に追加されることはありません。</p>
        {data.memberNotes.filter(n => !n.memberId && matches(n.name, n.memberNo, n.company)).map(n => <button key={n.id} className={`${button} mr-2 mb-2`} onClick={() => setEditNote(n.id)}>{n.memberNo} {n.name}</button>)}
        {note && <section className="space-y-4 rounded border bg-white p-4"><h2 className="font-bold">運営情報：{note.name}</h2><label className="block">HP会員との紐付け<select className={input} value={note.memberId} onChange={e => updateNote({ memberId: e.target.value })}><option value="">外部会員・未連携</option>{members.map(m => <option value={m.id} key={m.id}>{m.memberNo} {m.name}</option>)}</select></label>
          <div className="grid gap-3 md:grid-cols-2">{([['memberNo','移行元NM-ID'],['name','移行元氏名'],['company','移行元会社名'],['industry','移行元業種'],['attribute','属性'],['industryDetail','業種詳細'],['desiredPartners','希望提携先'],['oneOnOneUrl','1on1シートURL'],['facebookUrl','移行元Facebook URL'],['note','運営メモ・会員期限など']] as const).map(([key,label]) => <Field key={key} label={label} value={note[key]} onChange={value => updateNote({ [key]: value })} />)}</div><p className="text-xs text-slate-600">氏名・会社名などの基本情報は「基本情報編集」で変更します。上記の移行元情報・運営メモは公開されません。</p><button className={button} onClick={() => setEditNote("")}>編集欄を閉じる（変更は保持）</button></section>}
      </>}
      {tab === "受講状況" && <>
        <p className="text-sm">移行元の記録日時を残しています。空欄は未受講と断定せず「未確認」です。変更後は上の保存ボタンを押してください。</p>
        <label className="block">会員の受講記録を選ぶ<select className={input} value={editTraining} onChange={e => setEditTraining(e.target.value)}><option value="">選択してください</option>{data.training.map(t => <option key={t.id} value={t.id}>{t.memberNo} {t.name}{!t.memberId ? "（照合待ち）" : ""}</option>)}</select></label>
        <label className="block">未登録の会員に受講記録を追加<select className={input} value="" onChange={e => { const m = members.find(m => m.id === e.target.value); if (!m) return; const t: Training = { id: newId(), memberId: m.id, memberNo: m.memberNo, name: m.name, courses: emptyCourses(), sourceAsOf: "HPで新規登録", note: "" }; change(d => ({ ...d, training: [...d.training, t] })); setEditTraining(t.id); }}><option value="">会員を選択</option>{members.filter(m => !data.training.some(t => t.memberId === m.id)).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        {training && <section className="space-y-3 rounded border bg-white p-4"><h2 className="font-bold">{training.name}</h2><p className="text-sm">記録時点：{training.sourceAsOf || "未設定"}</p><label className="block">HP会員との紐付け<select className={input} value={training.memberId} onChange={e => updateTraining({ memberId: e.target.value })}><option value="">照合待ち</option>{members.map(m => <option value={m.id} key={m.id}>{m.memberNo} {m.name}</option>)}</select></label>{COURSES.map(course => <div key={course} className="grid gap-2 border-t pt-3 sm:grid-cols-3"><span className="font-bold">{course}</span><select aria-label={`${course}の受講状況`} className={input} value={training.courses[course].status} onChange={e => updateTraining({ courses: { ...training.courses, [course]: { ...training.courses[course], status: e.target.value as TrainingStatus } } })}>{TRAINING_STATUSES.map(s => <option key={s}>{s}</option>)}</select><input aria-label={`${course}の受講日`} type="date" className={input} value={training.courses[course].date} onChange={e => updateTraining({ courses: { ...training.courses, [course]: { ...training.courses[course], date: e.target.value } } })} /></div>)}<Field label="記録時点・確認日" value={training.sourceAsOf} onChange={sourceAsOf => updateTraining({ sourceAsOf })} /><Field label="備考" value={training.note} onChange={note => updateTraining({ note })} /></section>}
        <Search value={search} onChange={setSearch} /><Table headers={["氏名", ...COURSES]} rows={data.training.filter(t => matches(t.name, t.memberNo)).map(t => [t.name, ...COURSES.map(c => `${t.courses[c].status}${t.courses[c].date ? ` (${t.courses[c].date})` : ""}`)])} />
      </>}
      {tab === "10分セミナー担当" && <>
        <p><Link href="/admin/member-resources" className="font-bold text-forest underline">会員を入会順で確認・CSV保存する</Link></p>
        <button className={button} onClick={() => { const s: Seminar = { id: newId(), month: "", memberIds: [], presenterNames: "", status: "要確認", title: "", note: "" }; change(d => ({ ...d, seminars: [...d.seminars, s] })); setEditSeminar(s.id); }}>担当予定を追加</button>
        {seminar && <section className="space-y-3 rounded border bg-white p-4"><Field label="担当月" type="month" value={seminar.month} onChange={month => updateSeminar({ month })} /><label className="block">会員から担当者を選択（複数可）<select multiple className={`${input} h-36`} value={seminar.memberIds} onChange={e => { const memberIds = Array.from(e.target.selectedOptions, o => o.value); updateSeminar({ memberIds, presenterNames: members.filter(m => memberIds.includes(m.id)).map(m => m.name).join("・") }); }}>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><Field label="担当者名（ゲスト・未確定の方も入力可）" value={seminar.presenterNames} onChange={presenterNames => updateSeminar({ presenterNames })} /><Field label="セミナータイトル" value={seminar.title} onChange={title => updateSeminar({ title })} /><label className="block">状態<select className={input} value={seminar.status} onChange={e => updateSeminar({ status: e.target.value as Seminar["status"] })}>{["予定", "終了", "要確認"].map(s => <option key={s}>{s}</option>)}</select></label><Field label="備考・移行元の記録" value={seminar.note} onChange={note => updateSeminar({ note })} /><div className="flex gap-3"><button className={button} onClick={() => setEditSeminar("")}>編集欄を閉じる</button><button className={button} onClick={() => { if (window.confirm("この担当予定を削除しますか？保存すると反映されます。")) { change(d => ({ ...d, seminars: d.seminars.filter(s => s.id !== seminar.id) })); setEditSeminar(""); } }}>この予定を削除</button></div></section>}
        <div className="grid gap-3">{[...data.seminars].sort((a,b) => a.month.localeCompare(b.month)).map(s => <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded border bg-white p-4"><div><p className="font-bold">{s.month || "月未定"}　{s.presenterNames || "担当者未定"}</p><p className="text-sm">{s.status}　{s.title}</p></div><button className={button} onClick={() => setEditSeminar(s.id)}>編集</button></div>)}</div>
      </>}
      {tab === "参加申込受付" && <>
        <p className="text-sm">HP参加申込と既存のGoogleフォーム連携の回答です。対象月例会と本人を確認して参加者名簿へ反映します。HPで修正した情報を、過去の回答で自動上書きしません。</p>
        <Link href="/entry" className="font-bold text-forest underline">HPの参加申込フォームを開く</Link>
        <details><summary className="cursor-pointer text-sm">旧Googleフォーム連携の設定（HP申込には不要）</summary><section className="space-y-3 rounded border bg-white p-4"><h2 className="font-bold">連携設定</h2><p>{integration === null ? "連携状況を確認してください。" : integration ? "HPの受信キー：発行済み（Google側の承認・トリガー設定が別途必要です）" : "未設定：Google側の送信設定が必要です"}</p><button className={button} disabled={integration === true} onClick={() => action(async () => { const result = await jsonRequest("/api/admin/form-integration", { method: "POST" }); setScript(result.script); setIntegration(true); download("needsmatch-google-forms.gs", result.script, "text/plain;charset=utf-8"); setMessage("連携スクリプトを保存しました。Google Apps Scriptに設定し、installNeedsMatchSyncを実行・承認してください。"); })}>初回連携スクリプトを発行・保存</button>{script && <button className={button} onClick={() => download("needsmatch-google-forms.gs", script, "text/plain;charset=utf-8")}>スクリプトをもう一度保存</button>}<p className="text-xs text-slate-600">スクリプトには連携用の秘密キーが含まれます。第三者に共有しないでください。Googleの承認はフォーム管理者のアカウントで行います。元シートのセルは変更しません。初回は過去の回答も順次受信します。</p></section></details>
        <button className={button} onClick={() => action(loadResponses)}>回答を再読み込み</button><Search value={search} onChange={setSearch} />
        {!responsesLoaded ? <p>回答を読み込んでください。</p> : <p>{responses.length}件受信済み。未反映 {responses.filter(r => !r.applied).length}件。再送された同じ回答は重複登録しません。</p>}
        <div className="space-y-3">{responses.filter(r => matches(r.name, r.meetingDate, r.company)).sort((a,b) => b.submittedAt.localeCompare(a.submittedAt)).map(r => <FormResponseCard key={r.sourceId} response={r} members={members} meetings={meetings} duplicates={responses.filter(other => other.sourceId !== r.sourceId && other.meetingDate === r.meetingDate && other.name.replace(/\s/g, "") === r.name.replace(/\s/g, "")).length} onApply={(applyMeetingId, memberId) => action(async () => {
          const current = await fetchStoredParticipants(applyMeetingId); if (!current) throw new Error("出欠を確認できませんでした。");
          const before = memberId ? current.statuses?.[memberId] || "未回答" : "新規ゲスト";
          if (!window.confirm(`${r.name}さんを参加者名簿へ反映します。現在：${before} → 参加。よろしいですか？`)) return;
          await jsonRequest(`/api/admin/form-responses/${r.sourceId}/apply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meetingId: applyMeetingId, memberId, expectedVersion: memberId ? current.versions?.[memberId] ?? null : null, guestsUpdatedAt: current.guestsUpdatedAt ?? null }) });
          await loadResponses(); setMessage("参加者名簿へ反映しました。テーブルへの配置はテーブル割り画面で追加してください。");
          if (meetingId === applyMeetingId) setAttendance(await fetchStoredParticipants(applyMeetingId));
        })} />)}</div>
      </>}
      <details className="rounded border bg-white p-4"><summary className="cursor-pointer text-sm font-bold">データの保管・初回移行</summary><p className="my-3 whitespace-pre-wrap text-xs text-slate-600">{data.sourceNote || "移行データはまだ登録されていません。"}</p><div className="flex flex-wrap gap-3"><button className={button} onClick={() => download("運営データ-backup.json", JSON.stringify(data, null, 2), "application/json")}>運営データをバックアップ</button><label className={button}>初回移行JSONを読み込む<input className="sr-only" type="file" accept="application/json,.json" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ""; }} /></label></div><p className="mt-2 text-xs text-slate-600">バックアップには個人情報・運営情報が含まれます。運営内で保管してください。会員基本情報・出欠・フォーム回答は別途サーバーに保存されます。</p></details>
    </fieldset>
  </div>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) { return <label className="grid min-w-0 gap-1 text-sm">{label}<input className={input} type={type} value={value} onChange={e => onChange(e.target.value)} /></label>; }
function Search({ value, onChange }: { value: string; onChange: (v: string) => void }) { return <Field label="氏名・番号・会社などで検索" value={value} onChange={onChange} />; }
function Table({ headers, rows }: { headers: string[]; rows: string[][] }) { return <div className="overflow-x-auto rounded border bg-white"><table className="w-full text-left text-sm"><thead><tr>{headers.map(h => <th key={h} className="whitespace-nowrap border-b bg-slate-50 p-3">{h}</th>)}</tr></thead><tbody>{rows.map((r,i) => <tr key={i} className="border-b">{r.map((v,j) => <td key={j} className="min-w-24 p-3 align-top">{v}</td>)}</tr>)}</tbody></table></div>; }
function FormResponseCard({ response: r, members, meetings, duplicates, onApply }: { response: FormResponse; members: Member[]; meetings: Meeting[]; duplicates: number; onApply: (meetingId: string, memberId: string) => Promise<void> }) {
  const candidates = meetings.filter(m => (!r.meetingDate || m.date === r.meetingDate) && m.status !== "下書き");
  const [meetingId, setMeetingId] = useState(candidates.length === 1 ? candidates[0].id : "");
  const match = matchMember(members, r.memberNo, r.name);
  const [person, setPerson] = useState(match?.id ?? "");
  if (!r.name.trim()) return <section className="space-y-2 rounded border border-amber-300 bg-amber-50 p-4"><h2 className="font-bold">氏名要確認（元シート {r.sourceRow}行目）</h2><p>{r.submittedAt} / {r.meetingDate || "開催日未確認"}</p><p className="text-sm">氏名を特定できないため、参加者名簿には反映できません。元シートの回答を確認し、必要なら参加者管理から手動で登録してください。</p></section>;
  return <section className="space-y-3 rounded border bg-white p-4"><h2 className="font-bold">{r.meetingDate}　{r.name}　{r.applied ? "反映済み" : "確認待ち"}</h2><p className="text-sm">{r.company} / {r.industry} / {r.branchName}</p><p className="text-xs text-slate-600">受付元：{r.source === "hp" ? "HP申込" : "Googleフォーム"}　回答日時：{r.submittedAt}　NM-ID：{r.memberNo || "未入力"}</p>{duplicates > 0 && <p className="text-sm font-bold text-amber-700">同じ日・同じ氏名の回答がほかに{duplicates}件あります。重複に注意してください。</p>}<details><summary className="cursor-pointer text-sm">回答の詳細（運営専用）</summary><dl className="mt-2 grid gap-2 break-words text-sm">{[["フリガナ",r.kana],["懇親会",r.socialAttendance],["業種詳細",r.industryDetail],["希望提携先",r.desiredPartners],["紹介者",r.referrer],["メール",r.email],["電話",r.phone],["備考",r.note]].map(([k,v]) => <div key={k}><dt className="font-bold">{k}</dt><dd className="whitespace-pre-wrap">{v || "—"}</dd></div>)}</dl></details>{!r.applied && <div className="grid gap-2 sm:grid-cols-3"><select className={input} aria-label={`${r.name}の対象月例会`} value={meetingId} onChange={e => setMeetingId(e.target.value)}><option value="">対象月例会を選択</option>{candidates.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select><select className={input} aria-label={`${r.name}の参加区分`} value={person} onChange={e => setPerson(e.target.value)}><option value="">本人・区分を確認</option><option value="guest">ゲスト・他支部として追加</option>{members.map(m => <option key={m.id} value={m.id}>{m.memberNo} {m.name}</option>)}</select><button className={button} disabled={!meetingId || !person} onClick={() => onApply(meetingId, person === "guest" ? "" : person)}>確認して参加者名簿へ反映</button></div>}</section>;
}
