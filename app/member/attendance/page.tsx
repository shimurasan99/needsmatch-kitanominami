import Link from "next/link";
import { AttendanceForm } from "@/components/member/attendance-form";
import { meetings, members } from "@/lib/data/mock";

export default function MemberAttendancePage() {
  const meeting = meetings.find((item) => item.status === "確定") ?? meetings.at(-1)!;
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
      <Link href="/member" className="text-sm font-bold text-forest hover:underline">← 会員専用ページへ戻る</Link>
      <p className="mt-8 text-sm font-bold text-forest">ATTENDANCE</p>
      <h1 className="mt-2 text-3xl font-black text-deep">定例会 出欠回答</h1>
      <div className="mt-5 rounded bg-snow p-5">
        <h2 className="text-xl font-black text-deep">{meeting.title}</h2>
        <p className="mt-2 text-sm text-slate-600">{meeting.date} {meeting.startTime}〜{meeting.endTime}</p>
        <p className="mt-1 text-sm text-slate-600">{meeting.venueName}</p>
        <p className="mt-3 text-sm font-bold text-accent">回答期限: {meeting.applicationDeadline}</p>
      </div>
      <AttendanceForm meeting={meeting} members={members} />
    </section>
  );
}
