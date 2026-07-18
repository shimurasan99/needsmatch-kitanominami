import Link from "next/link";
import { AttendancePageClient } from "@/components/member/attendance-page-client";
import { meetings, members } from "@/lib/data/mock";

export default function MemberAttendancePage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
      <Link href="/member" className="text-sm font-bold text-forest hover:underline">← 会員専用ページへ戻る</Link>
      <p className="mt-8 text-sm font-bold text-forest">ATTENDANCE</p>
      <h1 className="mt-2 text-3xl font-black text-deep">定例会 出欠回答</h1>
      <AttendancePageClient initialMeetings={meetings} members={members} />
    </section>
  );
}
