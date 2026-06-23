import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { meetings } from "@/lib/data/mock";

export default function AdminMeetingsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const tab = searchParams.tab === "past" ? "past" : "list";
  const currentMeetings = meetings.filter((meeting) => meeting.status !== "終了");
  const pastMeetings = meetings.filter((meeting) => meeting.status === "終了");

  return (
    <AdminShell title="月例会日程管理">
      <div className="mb-5 flex flex-wrap gap-2">
        <Link href="/admin/meetings" className={`focus-ring rounded px-4 py-2 text-sm font-bold ${tab === "list" ? "bg-forest text-white" : "border border-slate-200 bg-white"}`}>月例会一覧</Link>
        <Link href="/admin/meetings?tab=past" className={`focus-ring rounded px-4 py-2 text-sm font-bold ${tab === "past" ? "bg-forest text-white" : "border border-slate-200 bg-white"}`}>過去データ入力</Link>
        <button className="focus-ring rounded bg-accent px-4 py-2 text-sm font-bold text-white">月例会の新規作成</button>
      </div>

      {tab === "past" ? (
        <div className="grid gap-5">
          <form className="grid gap-4 rounded border border-slate-200 bg-white p-5 shadow-soft md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-600">月例会名</span>
              <input placeholder="2026年6月 北のみなみ月例会" className="focus-ring rounded border border-slate-200 px-3 py-3" />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-600">開催日</span>
              <input type="date" className="focus-ring rounded border border-slate-200 px-3 py-3" />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-600">開始時間</span>
              <input type="time" defaultValue="16:00" className="focus-ring rounded border border-slate-200 px-3 py-3" />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-600">終了時間</span>
              <input type="time" defaultValue="18:00" className="focus-ring rounded border border-slate-200 px-3 py-3" />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-600">会場名</span>
              <input placeholder="札幌ビジネス交流ラウンジ" className="focus-ring rounded border border-slate-200 px-3 py-3" />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-600">参加人数</span>
              <input type="number" min="0" placeholder="24" className="focus-ring rounded border border-slate-200 px-3 py-3" />
            </label>
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-bold text-slate-600">備考・振り返り</span>
              <textarea rows={4} placeholder="当日の内容、参加者メモ、次回への引き継ぎなど" className="focus-ring rounded border border-slate-200 px-3 py-3" />
            </label>
            <div className="md:col-span-2">
              <button className="focus-ring rounded bg-forest px-5 py-3 text-sm font-bold text-white">過去データを登録</button>
            </div>
          </form>
          <div className="grid gap-3">
            {pastMeetings.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
        {currentMeetings.map((meeting) => (
          <MeetingCard key={meeting.id} meeting={meeting} />
        ))}
      </div>
      )}
    </AdminShell>
  );
}

function MeetingCard({ meeting }: { meeting: (typeof meetings)[number] }) {
  return (
          <article key={meeting.id} className="rounded border border-slate-200 bg-white p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-forest">{meeting.status}</p>
                <h2 className="mt-1 text-xl font-black text-deep">{meeting.title}</h2>
                <p className="mt-2 text-sm text-slate-600">{meeting.date} {meeting.startTime}-{meeting.endTime} / {meeting.venueName}</p>
              </div>
              <div className="flex gap-2">
                <Link href={`/admin/meetings/${meeting.id}/participants`} className="focus-ring rounded border border-slate-200 px-3 py-2 text-sm font-bold">参加者管理</Link>
                <Link href={`/admin/meetings/${meeting.id}/table-assignments`} className="focus-ring rounded bg-deep px-3 py-2 text-sm font-bold text-white">テーブル割り</Link>
              </div>
            </div>
          </article>
  );
}
