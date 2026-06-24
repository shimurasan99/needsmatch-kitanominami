import { AdminShell } from "@/components/admin/admin-shell";
import { MemberManagement } from "@/components/admin/member-management";
import { members } from "@/lib/data/mock";

export default function AdminMembersPage() {
  return (
    <AdminShell title="会員管理">
      <MemberManagement initialMembers={members} />
    </AdminShell>
  );
}
