"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Meeting } from "@/types/domain";
import { adminInput as input } from "@/components/admin/private-record";
export function EntryForm() {
  const [meetings, setMeetings] = useState<Meeting[]>([]), [token, setToken] = useState(""), [meetingId, setMeetingId] = useState("");
  const [kind, setKind] = useState("ゲスト"), [busy, setBusy] = useState(false), [error, setError] = useState(""), [receipt, setReceipt] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/entry", { cache: "no-store" }).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); return data; }).then(data => { if (active) { setMeetings(data.meetings); setToken(data.token); setMeetingId(data.meetings[0]?.id || ""); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  if (receipt) return <section role="status" className="space-y-4 rounded border border-green-300 bg-green-50 p-6"><h2 className="text-2xl font-bold">参加申込を受け付けました</h2><p>受付番号：{receipt}</p><p>運営が内容を確認し、参加者名簿に反映します。この画面を控えてください。自動返信メールは送信されません。変更・キャンセルは運営または紹介者へご連絡ください。</p><Link className="underline" href="/">トップページへ</Link></section>;
  const meeting = meetings.find(m => m.id === meetingId);
  return <form className="space-y-5 rounded border bg-white p-5 shadow-soft sm:p-8" onSubmit={async e => {
    e.preventDefault(); if (busy) return; setBusy(true); setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const r = await fetch("/api/entry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, token, consent: data.consent === "on" }) });
      const result = await r.json(); if (!r.ok || !result.accepted) throw new Error(result.error || "受付を確認できませんでした。");
      setReceipt(result.receipt);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "送信できませんでした。"); } finally { setBusy(false); }
  }}>
    <h2 className="text-2xl font-bold text-deep">HPから参加を申し込む</h2>
    <p className="text-sm">個人のGoogleアカウントは不要です。北のみなみ会員の通常の出欠回答は<Link href="/member/attendance" className="underline">会員専用ページ</Link>からも行えます。</p>
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
    {!token && !error && <p>受付可能な日程を確認中…</p>}
    {token && !meetings.length && <p>現在受付中の月例会はありません。運営へお問い合わせください。</p>}
    <fieldset disabled={busy || !token || !meetings.length} className="space-y-4">
      <input type="hidden" name="meetingDate" value={meeting?.date || ""} />
      <label className="block">開催日（必須）<select className={input} name="meetingId" value={meetingId} required onChange={e => setMeetingId(e.target.value)}>{meetings.map(m => <option value={m.id} key={m.id}>{m.date} {m.title}</option>)}</select></label>
      {meeting && <p className="rounded bg-snow p-3 text-sm">{meeting.startTime}開始 ／ {meeting.venueName || "会場調整中"}<br />{meeting.venueAddress}<br />申込期限：{meeting.applicationDeadline || "開催前まで"}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label>参加区分（必須）<select className={input} name="participantType" value={kind} onChange={e => setKind(e.target.value)}>{["ゲスト", "他支部", "北のみなみ"].map(v => <option key={v}>{v}</option>)}</select></label>
        {kind === "他支部" && <label>支部名（必須）<input className={input} name="branchName" maxLength={100} required /></label>}
        {([["name", "お名前（フルネーム）", "text", 100], ["kana", "フリガナ（フルネーム）", "text", 100], ["email", "メールアドレス", "email", 254], ["phone", "電話番号", "tel", 40], ["company", "会社名／屋号", "text", 200], ["industry", "業種", "text", 200]] as const).map(([name, label, type, max]) => <label key={name}>{label}（必須）<input className={input} name={name} type={type} required maxLength={max} /></label>)}
        {kind !== "ゲスト" && <label>NM-ID（任意）<input className={input} name="memberNo" maxLength={30} /></label>}
        <label>紹介者のお名前{kind === "ゲスト" ? "（必須）" : "（任意）"}<input className={input} name="referrer" maxLength={100} required={kind === "ゲスト"} /></label>
      </div>
      {([["industryDetail", "業種詳細"], ["desiredPartners", "希望提携先"], ["note", "備考"]] as const).map(([name, label]) => <label key={name} className="block">{label}（任意）<textarea className={input} name={name} rows={3} maxLength={2000} /></label>)}
      <label className="block">優の会（懇親会）への参加希望（必須）<select className={input} name="socialAttendance" required defaultValue=""><option value="" disabled>選択してください</option>{["参加", "不参加", "未定"].map(v => <option key={v}>{v}</option>)}</select></label>
      <p className="text-sm">懇親会は支部外の方も参加されます。会場・費用等は運営にご確認ください。</p>
      <div aria-hidden="true" className="hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <label className="flex items-start gap-3 rounded bg-slate-50 p-4 text-sm"><input className="mt-1 h-5 w-5 shrink-0" name="consent" type="checkbox" required /><span>入力情報を定例会の連絡・参加者管理に利用することに同意します。メール・電話・回答の詳細は運営のみが閲覧します。氏名・会社名・業種は参加者名簿や公開テーブル割りに掲載される場合があります。</span></label>
      <button type="submit" className="w-full rounded bg-forest px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? "保存中…" : "この内容で参加を申し込む"}</button>
    </fieldset>
  </form>;
}
