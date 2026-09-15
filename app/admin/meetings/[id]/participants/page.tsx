import { AdminShell } from "@/components/admin/admin-shell";
import { ParticipantManager } from "@/components/admin/participant-manager";
import { members, participants } from "@/lib/data/mock";

export default async function ParticipantsPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const rows = participants.filter((p) => p.meetingId === params.id);
  return (
    <AdminShell title="参加者管理">
      <ParticipantManager meetingId={params.id} initialMembers={members} initialParticipants={rows} />
    </AdminShell>
  );
}
