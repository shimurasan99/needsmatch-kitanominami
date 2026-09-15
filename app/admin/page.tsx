import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { meetings, members } from "@/lib/data/mock";

export default function AdminPage() {
  return (
    <AdminShell title="運営ダッシュボード">
      <AdminDashboard initialMembers={members} initialMeetings={meetings} />
    </AdminShell>
  );
}
