import { AdminShell } from "@/components/admin/admin-shell";
import { meetings, members, participants } from "@/lib/data/mock";

export default function AdminPage() {
  return (
    <AdminShell title="運営ダッシュボード">
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="在籍会員" value={`${members.filter((m) => m.status === "在籍").length}名`} />
        <Stat label="次回参加者" value={`${participants.length}名`} />
        <Stat label="確定月例会" value={`${meetings.filter((m) => m.status === "確定").length}件`} />
      </div>
      <div className="mt-6 rounded border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900">
        本番では Supabase Auth のログイン状態と users / roles テーブルで、一般会員の運営専用ページアクセスを拒否します。
      </div>
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-200 bg-white p-5 shadow-soft">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-deep">{value}</p>
    </div>
  );
}
