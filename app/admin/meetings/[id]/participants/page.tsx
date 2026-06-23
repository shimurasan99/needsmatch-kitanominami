import { AdminShell } from "@/components/admin/admin-shell";
import { ParticipantManager } from "@/components/admin/participant-manager";
import { members, participants } from "@/lib/data/mock";

export default function ParticipantsPage({ params }: { params: { id: string } }) {
  const rows = participants.filter((p) => p.meetingId === params.id);
  return (
    <AdminShell title="参加者管理">
      <ParticipantManager meetingId={params.id} initialMembers={members} initialParticipants={rows} />
    </AdminShell>
  );
}
