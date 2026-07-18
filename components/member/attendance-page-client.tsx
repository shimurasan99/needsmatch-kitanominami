"use client";

import { useEffect, useMemo, useState } from "react";
import { AttendanceForm } from "@/components/member/attendance-form";
import { fetchMeetings } from "@/lib/data/meeting-storage";
import type { Meeting, Member } from "@/types/domain";

export function AttendancePageClient({ initialMeetings, members }: { initialMeetings: Meeting[]; members: Member[] }) {
  const [meetings, setMeetings] = useState(initialMeetings);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  const upcoming = useMemo(() => meetings.filter((meeting) => meeting.status === "確定" && meeting.date >= today).sort((a, b) => a.date.localeCompare(b.date)), [meetings, today]);
  const [meetingId, setMeetingId] = useState(upcoming[0]?.id ?? "");

  useEffect(() => {
    void fetchMeetings(initialMeetings).then((value) => {
      setMeetings(value);
      const first = value.filter((meeting) => meeting.status === "確定" && meeting.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
      setMeetingId((current) => value.some((meeting) => meeting.id === current && meeting.status === "確定" && meeting.date >= today) ? current : first?.id ?? "");
    });
  }, [initialMeetings, today]);

  const meeting = upcoming.find((item) => item.id === meetingId) ?? upcoming[0];
  if (!meeting) return <p className="mt-8 rounded bg-snow p-5 font-bold text-slate-600">現在、回答受付中の月例会はありません。</p>;

  return (
    <>
      <label className="mt-8 grid gap-2">
        <span className="font-bold text-deep">回答する月例会</span>
        <select value={meeting.id} onChange={(event) => setMeetingId(event.target.value)} className="focus-ring rounded border border-slate-300 bg-white px-4 py-3 font-bold">
          {upcoming.map((item) => <option key={item.id} value={item.id}>{item.date.replaceAll("-", "/")}　{item.title}</option>)}
        </select>
      </label>
      <div className="mt-5 rounded bg-snow p-5">
        <h2 className="text-xl font-black text-deep">{meeting.title}</h2>
        <p className="mt-2 text-sm text-slate-600">{meeting.date} {meeting.startTime}〜{meeting.endTime}</p>
        <p className="mt-1 text-sm text-slate-600">{meeting.venueName}</p>
        <p className="mt-3 text-sm font-bold text-accent">回答期限: {meeting.applicationDeadline}</p>
      </div>
      <AttendanceForm key={meeting.id} meeting={meeting} members={members} />
    </>
  );
}
