"use client";

import { useEffect, useMemo, useState } from "react";
import { AttendanceForm } from "@/components/member/attendance-form";
import { fetchMeetings } from "@/lib/data/meeting-storage";
import { fetchManagedMembers } from "@/lib/data/member-overrides";
import type { Meeting, Member } from "@/types/domain";

export function AttendancePageClient({ initialMeetings, members }: { initialMeetings: Meeting[]; members: Member[] }) {
  const [meetings, setMeetings] = useState(initialMeetings);
  const [managedMembers, setManagedMembers] = useState(members);
  const [loadError, setLoadError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  const upcoming = useMemo(() => meetings.filter((meeting) => meeting.status === "確定" && meeting.date >= today).sort((a, b) => a.date.localeCompare(b.date)), [meetings, today]);
  const [meetingId, setMeetingId] = useState(upcoming[0]?.id ?? "");

  useEffect(() => {
    let active = true;
    let inFlight = false;
    async function refresh() {
      if (!active || inFlight) return;
      inFlight = true;
      try {
        const [value, nextMembers] = await Promise.all([fetchMeetings(initialMeetings), fetchManagedMembers(members)]);
        if (!active) return;
        setMeetings(value);
        setManagedMembers(nextMembers);
        const first = value.filter((meeting) => meeting.status === "確定" && meeting.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
        setMeetingId((current) => value.some((meeting) => meeting.id === current && meeting.status === "確定" && meeting.date >= today) ? current : first?.id ?? "");
        setLoadError("");
        setLoaded(true);
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : "最新情報の読み込みに失敗しました。");
      } finally {
        inFlight = false;
      }
    }
    function refreshVisible() { if (document.visibilityState !== "hidden") void refresh(); }
    void refresh();
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    const interval = window.setInterval(refreshVisible, 30_000);
    return () => {
      active = false;
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
      window.clearInterval(interval);
    };
  }, [initialMeetings, members, today]);

  const meeting = upcoming.find((item) => item.id === meetingId) ?? upcoming[0];
  if (loadError && !loaded) return <p role="alert" className="mt-8 rounded bg-red-50 p-5 text-accent">{loadError}</p>;
  if (!loaded) return <p role="status" className="mt-8">出欠情報を読み込み中…</p>;
  if (!meeting) return <p className="mt-8 rounded bg-snow p-5 font-bold text-slate-600">現在、回答受付中の月例会はありません。</p>;

  return (
    <>
      {loadError && <p role="alert" className="mt-8 rounded bg-red-50 p-5 text-accent">最新情報を取得できませんでした。入力内容は保持しています。{loadError}</p>}
      <label className="mt-8 grid min-w-0 w-full gap-2">
        <span className="font-bold text-deep">回答する月例会</span>
        <select value={meeting.id} onChange={(event) => setMeetingId(event.target.value)} className="focus-ring min-w-0 w-full max-w-full rounded border border-slate-300 bg-white px-4 py-3 font-bold">
          {upcoming.map((item) => <option key={item.id} value={item.id}>{item.date.replaceAll("-", "/")}　{item.title}</option>)}
        </select>
      </label>
      <div className="mt-5 rounded bg-snow p-5">
        <h2 className="text-xl font-black text-deep">{meeting.title}</h2>
        <p className="mt-2 text-sm text-slate-600">{meeting.date} {meeting.startTime}〜{meeting.endTime}</p>
        <p className="mt-1 text-sm text-slate-600">{meeting.venueName}</p>
        <p className="mt-3 text-sm font-bold text-accent">回答期限: {meeting.applicationDeadline}</p>
      </div>
      <p className="mt-5 text-sm text-slate-600">お名前と出欠を選び「この内容で保存」を押してください。保存完了後は、他のPC・スマホや運営の参加者管理でも同じ回答を確認できます。</p>
      <AttendanceForm key={meeting.id} meeting={meeting} members={managedMembers} />
    </>
  );
}
