import { AdminShell } from "@/components/admin/admin-shell";
import { TableAssignmentManager } from "@/components/admin/table-assignment-manager";
import { members, participants, meetings } from "@/lib/data/mock";

export default async function AdminTableAssignmentsPage({ params: paramsPromise, searchParams: searchParamsPromise }: { params: Promise<{ id: string }>; searchParams: Promise<{ seats?: string }> }) {
  const [params, searchParams] = await Promise.all([paramsPromise, searchParamsPromise]);
  const seatsPerTable = Math.min(Math.max(Number(searchParams.seats ?? 5) || 5, 4), 8);
  return (
    <AdminShell title="自動テーブル割り">
      <TableAssignmentManager
        meetingId={params.id}
        initialMembers={members}
        initialParticipants={participants}
        initialMeetings={meetings}
        initialSeatsPerTable={seatsPerTable}
      />
    </AdminShell>
  );
}
