import { AdminShell } from "@/components/admin/admin-shell";
import { TableAssignmentManager } from "@/components/admin/table-assignment-manager";
import { members, participants, recentPastAssignments } from "@/lib/data/mock";

export default function AdminTableAssignmentsPage({ params, searchParams }: { params: { id: string }; searchParams: { seats?: string } }) {
  const seatsPerTable = Math.min(Math.max(Number(searchParams.seats ?? 5) || 5, 4), 8);
  return (
    <AdminShell title="自動テーブル割り">
      <TableAssignmentManager
        meetingId={params.id}
        initialMembers={members}
        initialParticipants={participants}
        pastTables={recentPastAssignments}
        initialSeatsPerTable={seatsPerTable}
      />
    </AdminShell>
  );
}
