import { AdminShell } from "@/components/admin/admin-shell";
import { ThreadManager } from "@/components/admin/thread-manager";
import { messengerThreads } from "@/lib/data/mock";

export default function AdminThreadsPage() {
  return (
    <AdminShell title="メッセンジャースレッド管理">
      <ThreadManager initialThreads={messengerThreads} />
    </AdminShell>
  );
}
