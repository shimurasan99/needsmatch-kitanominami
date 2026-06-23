import { AdminShell } from "@/components/admin/admin-shell";
import { members, participants } from "@/lib/data/mock";

export default function ParticipantsPage({ params }: { params: { id: string } }) {
  const rows = participants.filter((p) => p.meetingId === params.id);
  return (
    <AdminShell title="参加者管理">
      <div className="mb-4 flex flex-wrap gap-2">
        <select className="focus-ring rounded border border-slate-200 bg-white px-3 py-2">
          {members.map((member) => <option key={member.id}>{member.name}</option>)}
        </select>
        <button className="focus-ring rounded bg-forest px-4 py-2 text-sm font-bold text-white">参加者追加</button>
        <button className="focus-ring rounded border border-slate-200 bg-white px-4 py-2 text-sm font-bold">ゲスト手動追加</button>
        <button className="focus-ring rounded border border-slate-200 bg-white px-4 py-2 text-sm font-bold">CSV出力</button>
      </div>
      <div className="rounded border border-slate-200 bg-white">
        {rows.map((row) => {
          const member = members.find((m) => m.id === row.memberId);
          return (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 last:border-b-0">
              <div>
                <p className="font-bold text-deep">{member?.name ?? row.guestName}</p>
                <p className="text-sm text-slate-600">{member?.industry ?? row.guestCompany ?? "ゲスト"}</p>
              </div>
              <select defaultValue={row.status} className="focus-ring rounded border border-slate-200 px-3 py-2">
                <option>参加</option><option>欠席</option><option>未定</option><option>ゲスト</option>
              </select>
            </div>
          );
        })}
      </div>
    </AdminShell>
  );
}
