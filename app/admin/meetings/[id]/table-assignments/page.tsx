import { AdminShell } from "@/components/admin/admin-shell";
import { TableAssignmentView } from "@/components/table-assignment/table-assignment-view";
import { members, participants, pastAssignments } from "@/lib/data/mock";
import { generateTableAssignment } from "@/lib/table-assignment/generator";

export default function AdminTableAssignmentsPage({ searchParams }: { searchParams: { seats?: string } }) {
  const seatsPerTable = Math.min(Math.max(Number(searchParams.seats ?? 5) || 5, 4), 8);
  const result = generateTableAssignment(participants, members, pastAssignments, 600, seatsPerTable);
  return (
    <AdminShell title="自動テーブル割り">
      <form className="mb-4 flex flex-wrap items-end gap-3 rounded border border-slate-200 bg-white p-4 shadow-soft">
        <label className="grid gap-2">
          <span className="text-sm font-bold text-slate-600">1テーブルあたりの人数</span>
          <select name="seats" defaultValue={String(seatsPerTable)} className="focus-ring rounded border border-slate-200 px-3 py-2">
            <option value="4">4人</option>
            <option value="5">5人</option>
            <option value="6">6人</option>
            <option value="7">7人</option>
            <option value="8">8人</option>
          </select>
        </label>
        <button className="focus-ring rounded bg-forest px-4 py-2 text-sm font-bold text-white">自動テーブル割り作成</button>
        <p className="text-sm text-slate-600">現在の設定: {seatsPerTable}人 / テーブル</p>
      </form>
      <TableAssignmentView tables={result.tables} score={result.score} warnings={result.warnings} />
    </AdminShell>
  );
}
