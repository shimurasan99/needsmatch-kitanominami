"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchMeetings } from "@/lib/data/meeting-storage";
import { readTableRecoveryMeetingIds } from "@/lib/data/table-assignment-recovery";
import type { AssignmentTable, Meeting, Member } from "@/types/domain";

export function PastDataManager({ meetings }: {
  meetings: Meeting[];
  members?: Member[];
  assignments?: AssignmentTable[];
  assignmentsByMeetingId?: Record<string, AssignmentTable[]>;
}) {
  const [managedMeetings, setManagedMeetings] = useState(meetings);
  const [activeMeetingId, setActiveMeetingId] = useState("");
  const [error, setError] = useState("");
  const [recoveryMeetingIds, setRecoveryMeetingIds] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    setRecoveryMeetingIds(readTableRecoveryMeetingIds());
    void fetchMeetings(meetings).then((next) => { if (active) setManagedMeetings(next); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "過去の定例会を読み込めませんでした。"); });
    return () => { active = false; };
  }, [meetings]);
  const pastMeetings = useMemo(() => managedMeetings.filter((meeting) => meeting.status === "終了" || meeting.date < new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date())).sort((a, b) => b.date.localeCompare(a.date)), [managedMeetings]);
  const selected = pastMeetings.find((meeting) => meeting.id === activeMeetingId) ?? pastMeetings[0];

  return <div className="grid gap-5 rounded border border-slate-200 bg-white p-5 shadow-soft">
    <div>
      <h2 className="text-2xl font-black text-deep">過去データ管理</h2>
      <p className="mt-2 text-sm text-slate-600">過去の定例会を選び、保存済みの参加状況とテーブル割りを確認・修正できます。</p>
    </div>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {recoveryMeetingIds.length > 0 && <section className="rounded bg-amber-50 p-4">
      <h3 className="font-bold">この端末に残っているテーブル割りの記録</h3>
      <p className="mt-2 text-sm">共有保存先にない場合も、以前の端末内保存から内容を確認できます。実際の履歴か確認してから共有保存してください。</p>
      <ul className="mt-2 grid gap-2">{recoveryMeetingIds.map((id) => <li key={id}><Link className="focus-ring underline" href={`/admin/meetings/${encodeURIComponent(id)}/table-assignments`}>{managedMeetings.find((meeting) => meeting.id === id)?.title ?? `保存記録（${id}）`}を確認する</Link></li>)}</ul>
    </section>}
    {selected ? <>
      <label className="grid gap-2">
        <span className="font-bold">対象の定例会</span>
        <select value={selected.id} onChange={(event) => setActiveMeetingId(event.target.value)} className="focus-ring rounded border border-slate-200 px-3 py-3">
          {pastMeetings.map((meeting) => <option key={meeting.id} value={meeting.id}>{meeting.date} {meeting.title}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap gap-3">
        <Link href={`/admin/meetings/${encodeURIComponent(selected.id)}/participants`} className="focus-ring rounded bg-forest px-4 py-3 font-bold text-white">参加者・出欠を管理する</Link>
        <Link href={`/admin/meetings/${encodeURIComponent(selected.id)}/table-assignments`} className="focus-ring rounded bg-forest px-4 py-3 font-bold text-white">テーブル割りを管理する</Link>
      </div>
      <p className="text-sm text-slate-600">テーブル割りを保存すると、後の定例会で同席の重複を確認する際にも使用されます。</p>
    </> : <p className="text-slate-600">過去の定例会データはまだありません。</p>}
  </div>;
}
