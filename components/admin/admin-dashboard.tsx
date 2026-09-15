"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchManagedMembers } from "@/lib/data/member-overrides";
import { fetchMeetings } from "@/lib/data/meeting-storage";
import { fetchStoredParticipants } from "@/lib/data/participant-storage";
import type { Meeting, Member } from "@/types/domain";

type Dashboard = { memberCount: number; meetingCount: number; attendeeCount: number; nextMeeting?: Meeting };

export function AdminDashboard({ initialMembers, initialMeetings }: { initialMembers: Member[]; initialMeetings: Meeting[] }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    let requestId = 0;
    const refresh = async () => {
      const currentRequest = ++requestId;
      setLoading(true);
      setError("");
      try {
        const [members, meetings] = await Promise.all([fetchManagedMembers(initialMembers), fetchMeetings(initialMeetings)]);
        const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
        const upcoming = meetings.filter((meeting) => meeting.status === "確定" && meeting.date >= today).sort((a, b) => a.date.localeCompare(b.date));
        const nextMeeting = upcoming[0];
        const attendance = nextMeeting ? await fetchStoredParticipants(nextMeeting.id) : null;
        if (!active || currentRequest !== requestId) return;
        setData({
          memberCount: members.filter((member) => member.status === "在籍").length,
          meetingCount: upcoming.length,
          attendeeCount: members.filter((member) => attendance?.statuses?.[member.id] === "参加").length + (attendance?.guests?.length ?? 0),
          nextMeeting
        });
      } catch (cause) {
        if (!active || currentRequest !== requestId) return;
        setData(null);
        setError(cause instanceof Error ? cause.message : "ダッシュボードを読み込めませんでした。");
      } finally { if (active && currentRequest === requestId) setLoading(false); }
    };
    void refresh();
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, [initialMembers, initialMeetings, revision]);

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-600">保存済みの会員情報・月例会・出欠回答を集計しています。</p>
      <button type="button" disabled={loading} onClick={() => setRevision((current) => current + 1)} className="focus-ring rounded border border-slate-200 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50">{loading ? "読み込み中…" : "最新の情報に更新"}</button>
    </div>
    {error && <p role="alert" className="rounded bg-red-50 p-4 font-bold text-red-700">{error}</p>}
    {loading && !data && <p role="status" className="text-sm text-slate-600">最新の集計を読み込んでいます…</p>}
    {data && <>
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="在籍会員" value={`${data.memberCount}名`} href="/admin/members" />
        <Stat label="次回参加者（ゲスト含む）" value={data.nextMeeting ? `${data.attendeeCount}名` : "予定なし"} href={data.nextMeeting ? `/admin/meetings/${encodeURIComponent(data.nextMeeting.id)}/participants` : "/admin/meetings"} />
        <Stat label="今後の確定月例会" value={`${data.meetingCount}件`} href="/admin/meetings" />
      </div>
      {data.nextMeeting && <p className="text-sm text-slate-600">次回の集計対象：{data.nextMeeting.date} {data.nextMeeting.title}</p>}
    </>}
  </div>;
}

function Stat({ label, value, href }: { label: string; value: string; href: string }) {
  return <Link href={href} className="focus-ring block rounded border border-slate-200 bg-white p-5 shadow-soft hover:bg-snow">
    <p className="text-sm font-bold text-slate-500">{label}</p>
    <p className="mt-2 text-3xl font-black text-deep">{value}</p>
  </Link>;
}
