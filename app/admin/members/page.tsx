import Image from "next/image";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { members } from "@/lib/data/mock";

export default function AdminMembersPage() {
  return (
    <AdminShell title="会員管理">
      <div className="mb-4 flex flex-wrap gap-2">
        <button className="focus-ring rounded bg-forest px-4 py-2 text-sm font-bold text-white">新規登録</button>
        <button className="focus-ring rounded border border-slate-200 bg-white px-4 py-2 text-sm font-bold">CSVインポート</button>
        <button className="focus-ring rounded border border-slate-200 bg-white px-4 py-2 text-sm font-bold">CSVエクスポート</button>
      </div>
      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-snow text-slate-600">
            <tr>
              <th className="p-3">会員</th>
              <th className="p-3">業種</th>
              <th className="p-3">役職</th>
              <th className="p-3">状態</th>
              <th className="p-3">表示</th>
              <th className="p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-t border-slate-100">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <Image src={member.profileImageUrl} alt="" width={40} height={40} className="h-10 w-10 rounded object-cover" />
                    <div><p className="font-bold">{member.name}</p><p className="text-xs text-slate-500">{member.memberNo}</p></div>
                  </div>
                </td>
                <td className="p-3">{member.industry}</td>
                <td className="p-3">{member.position}</td>
                <td className="p-3">{member.status}</td>
                <td className="p-3">{member.isVisible ? "表示" : "非表示"}</td>
                <td className="p-3">
                  <Link href={`/admin/members/${member.id}`} className="focus-ring rounded border border-slate-200 px-3 py-1 font-bold">
                    編集
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
