import { AdminShell } from "@/components/admin/admin-shell";
import { MeetingsManagement } from "@/components/admin/meetings-management";
import { meetings, members, participants, recentPastAssignments } from "@/lib/data/mock";

export default function AdminMeetingsPage() {
  return (
    <AdminShell title="月例会日程管理">
      <MeetingsManagement meetings={meetings} members={members} participants={participants} pastAssignments={recentPastAssignments} />
    </AdminShell>
  );
}
