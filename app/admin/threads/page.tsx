import { AdminShell } from "@/components/admin/admin-shell";
import { messengerThreads } from "@/lib/data/mock";

export default function AdminThreadsPage() {
  return (
    <AdminShell title="メッセンジャースレッド管理">
      <button className="focus-ring mb-4 rounded bg-forest px-4 py-2 text-sm font-bold text-white">スレッド追加</button>
      <div className="grid gap-3">
        {messengerThreads.map((thread) => (
          <div key={thread.id} className="rounded border border-slate-200 bg-white p-4">
            <p className="font-bold text-deep">{thread.name}</p>
            <p className="mt-1 break-all text-sm text-slate-600">{thread.url}</p>
            <div className="mt-3 flex gap-2">
              <button className="focus-ring rounded border border-slate-200 px-3 py-1 text-sm font-bold">編集</button>
              <button className="focus-ring rounded border border-slate-200 px-3 py-1 text-sm font-bold">削除</button>
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
